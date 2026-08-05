#!/usr/bin/env bun
/**
 * Rank models on the turn AICO actually makes.
 *
 * Usage (from benchmark/):
 *   bun src/agenticBench.ts
 *   bun src/agenticBench.ts --iterations 5
 *   bun src/agenticBench.ts --vision-only
 *   bun src/agenticBench.ts --format json
 *
 * Candidates come from the model catalogue, filtered to models the probe has
 * shown to be alive (`scripts/providers/probe-models.ts`). Each is asked to
 * make a forced `route_decision` call on a German warehouse turn, and — if the
 * catalogue tags it `vision` — on the same turn with a glove-sized photo
 * attached.
 *
 * Reports the MEDIAN, not the mean. Provider latency is long-tailed; one
 * cold-start outlier drags a mean somewhere no user will ever experience,
 * while the median is the turn a worker actually waits through. Min and max
 * are printed alongside so a wide spread stays visible rather than hidden
 * behind a single reassuring number.
 */

import { AicoClient } from "./client";
import { agenticScenarios, ROUTE_DECISION_TOOL } from "./agenticScenario";
import { MODEL_CATALOG } from "../../backend/model-catalog/src/catalog";

const args = {
	iterations: 3,
	visionOnly: false,
	format: "console" as "console" | "json" | "markdown",
	url: process.env.AICO_BACKEND_URL || "http://localhost:8000",
	org: process.env.AICO_ORGANIZATION_ID || "",
	only: "",
	/** Explicit `provider:model,provider:model` list — beats the tag filter.
	 *  A full sweep costs real money and ~30 min; when the question is "which
	 *  of these five", ask exactly that. */
	models: "",
};

for (let i = 2; i < process.argv.length; i++) {
	const a = process.argv[i];
	if (a === "--iterations" || a === "-i") args.iterations = Number(process.argv[++i]);
	else if (a === "--vision-only") args.visionOnly = true;
	else if (a === "--format" || a === "-f") args.format = process.argv[++i] as never;
	else if (a === "--url" || a === "-u") args.url = process.argv[++i];
	else if (a === "--org" || a === "-o") args.org = process.argv[++i];
	else if (a === "--only") args.only = process.argv[++i];
	else if (a === "--models") args.models = process.argv[++i];
}

/**
 * Models worth timing.
 *
 * Excludes embeddings (not conversational) and anything the catalogue marks
 * unavailable. Reasoning-tier models are excluded too: they are slow BY
 * DESIGN, and including them would pad the table with rows whose ranking
 * nobody is in doubt about.
 */
const CANDIDATES = MODEL_CATALOG.flatMap((p) =>
	p.models
		.filter((m) => m.available !== false)
		.filter((m) => !(m.tags ?? []).includes("embedding"))
		.filter((m) => !(m.tags ?? []).includes("reasoning"))
		.map((m) => ({
			provider: p.provider,
			model: m.id,
			vision: (m.tags ?? []).includes("vision"),
			fast: (m.tags ?? []).includes("fast"),
			pricing: m.pricing,
		})),
).filter((c) => !args.only || c.provider === args.only);

const PICKED = args.models
	? new Set(args.models.split(",").map((x) => x.trim()))
	: null;
const SELECTED = PICKED
	? CANDIDATES.filter((c) => PICKED.has(`${c.provider}:${c.model}`))
	: CANDIDATES;

interface Row {
	provider: string;
	model: string;
	fast: boolean;
	vision: boolean;
	scenario: string;
	median: number | null;
	min: number | null;
	max: number | null;
	/** Median time to first token of any kind. */
	ttft: number | null;
	/** Median time to the first token of the spoken `response` field —
	 *  the number a user actually experiences as "it answered". */
	ttfr: number | null;
	ok: number;
	fail: number;
	error?: string;
	costPer1kTurns?: number;
}

function median(xs: number[]): number {
	const s = [...xs].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

const client = new AicoClient(args.url, args.org || undefined);
const scenarios = agenticScenarios();
const rows: Row[] = [];

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

for (const cand of SELECTED) {
	for (const scenario of scenarios) {
		if (scenario.needsVision && !cand.vision) continue;
		if (args.visionOnly && !scenario.needsVision) continue;

		const times: number[] = [];
		const ttfts: number[] = [];
		const ttfrs: number[] = [];
		let fail = 0;
		let firstError: string | undefined;
		let usage: { promptTokens: number; completionTokens: number } | undefined;

		for (let i = 0; i < args.iterations; i++) {
			const t0 = Date.now();
			try {
				// STREAMING, because a non-streaming call cannot answer the only
				// question that matters for a voice agent: how long before the
				// worker hears something. Total completion time is what the
				// server pays; TTFR is what the person waits.
				let done = false;
				for await (const ev of client.stream(
					cand.provider,
					scenario.messages,
					{ model: cand.model, temperature: 0, maxTokens: 400 },
					[ROUTE_DECISION_TOOL],
				)) {
					if (ev.type === "error") throw new Error(ev.error ?? "stream error");
					if (ev.type === "done" && ev.timing) {
						times.push(ev.timing.latencyMs);
						if (ev.timing.ttftMs != null) ttfts.push(ev.timing.ttftMs);
						if (ev.timing.ttfrMs != null) ttfrs.push(ev.timing.ttfrMs);
						if (ev.usage) {
							usage = {
								promptTokens: ev.usage.promptTokens,
								completionTokens: ev.usage.completionTokens,
							};
						}
						done = true;
					}
				}
				if (!done) times.push(Date.now() - t0);
			} catch (error) {
				fail++;
				firstError ??= error instanceof Error ? error.message : String(error);
			}
		}

		const cost =
			usage && cand.pricing
				? ((usage.promptTokens * cand.pricing.inputPer1M +
						usage.completionTokens * cand.pricing.outputPer1M) /
						1_000_000) *
					1000
				: undefined;

		const row: Row = {
			provider: cand.provider,
			model: cand.model,
			fast: cand.fast,
			vision: cand.vision,
			scenario: scenario.name,
			median: times.length ? median(times) : null,
			min: times.length ? Math.min(...times) : null,
			max: times.length ? Math.max(...times) : null,
			ttft: ttfts.length ? median(ttfts) : null,
			ttfr: ttfrs.length ? median(ttfrs) : null,
			ok: times.length,
			fail,
			error: firstError?.slice(0, 120),
			costPer1kTurns: cost,
		};
		rows.push(row);

		if (args.format === "console") {
			const label = `${cand.provider}:${cand.model}`;
			process.stderr.write(".");
			const verdict =
				row.median === null
					? red("FAIL")
					: `ttfr ${String(row.ttfr ?? "-").padStart(5)}ms  ttft ${String(row.ttft ?? "-").padStart(5)}ms  total ${String(row.median).padStart(6)}ms`;
			console.log(
				`  ${label.padEnd(50)} ${scenario.name.padEnd(18)} ${verdict}` +
					(row.fail && row.ok ? dim(`  ${row.fail} failed`) : "") +
					(row.median === null && row.error ? dim(`  ${row.error}`) : ""),
			);
		}
	}
}

if (args.format === "json") {
	console.log(JSON.stringify(rows, null, 2));
} else {
	console.log("");
	for (const scenario of scenarios) {
		const ranked = rows
			.filter((r) => r.scenario === scenario.name && r.median !== null)
			// Rank by TTFR, falling back to total for models that never emitted
			// a parseable `response` field.
			.sort((a, b) => (a.ttfr ?? a.median ?? 0) - (b.ttfr ?? b.median ?? 0));
		if (ranked.length === 0) continue;
		console.log(green(`FASTEST — ${scenario.name}  (ranked by TTFR: time until the user hears anything)`));
		for (const r of ranked.slice(0, 10)) {
			const cost = r.costPer1kTurns ? `$${r.costPer1kTurns.toFixed(2)}/1k` : dim("no pricing");
			console.log(
				`  ttfr ${String(r.ttfr ?? "-").padStart(5)}ms   ttft ${String(r.ttft ?? "-").padStart(5)}ms   total ${String(r.median).padStart(6)}ms   ${`${r.provider}:${r.model}`.padEnd(46)} ${cost}`,
			);
		}
		console.log("");
	}
	const broken = rows.filter((r) => r.median === null);
	if (broken.length) {
		console.log(red(`${broken.length} model/scenario combination(s) failed outright.`));
	}
}
