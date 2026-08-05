/**
 * The agentic turn, as a benchmark.
 *
 * Every other prompt in this suite measures a request AICO never makes. A real
 * turn is a FORCED TOOL CALL against a ~4 kB `route_decision` schema, with a
 * system prompt carrying flow instructions, channel hints and slot status —
 * and, on a wearable, a photo attached. Models rank very differently on that
 * than on "write a haiku": a model that streams prose quickly can still spend
 * seconds emitting a large structured argument, and a model that handles text
 * in 300 ms can take 20 s the moment an image is in the payload.
 *
 * The scenario below is lifted from the shape of the warehouse interpreter
 * flow (`konsultation-hauptflow`) — German, multilingual routing, damage
 * report with photo — because that is the workload we actually need to be
 * fast, on a glove, in front of a worker who is holding a broken pallet.
 */

import { readFileSync } from "node:fs";

import type { ChatMessage } from "./client";

/**
 * A real, decodable photo — the benchmark's most important input.
 *
 * The first version of this synthesised plausible bytes with a JPEG header,
 * on the theory that only the WEIGHT mattered. It does not: providers decode
 * the image, and a forged one gets rejected ("cannot identify image file"),
 * which silently turned every vision row into a failure rather than a
 * measurement. Vision cost also scales with DIMENSIONS, not bytes, so a
 * placeholder thumbnail would have understated the thing being measured.
 *
 * Resolution order — first hit wins:
 *   1. `$AICO_BENCH_IMAGE`      — point it at anything you like
 *   2. `assets/benchmark/glove-photo.jpg` — committed reference shot
 *   3. any PNG under `assets/`  — good enough to keep the suite runnable
 *
 * Falls back to null, and the photo scenario is then SKIPPED rather than run
 * against a fake: a missing measurement is honest, a fabricated one is not.
 */
export function benchmarkPhoto(): { data: string; mimeType: string } | null {
	const repoRoot = new URL("../../", import.meta.url).pathname;
	const candidates = [
		process.env.AICO_BENCH_IMAGE,
		`${repoRoot}assets/benchmark/glove-photo.jpg`,
		`${repoRoot}assets/games/dungeon-of-echoes/dungeon-entrance.png`,
	].filter(Boolean) as string[];

	for (const path of candidates) {
		try {
			const bytes = readFileSync(path);
			if (bytes.length === 0) continue;
			const mimeType = path.toLowerCase().endsWith(".png")
				? "image/png"
				: "image/jpeg";
			return { data: bytes.toString("base64"), mimeType };
		} catch {
			// Next candidate.
		}
	}
	return null;
}

/** The `route_decision` tool, structurally identical to the live one. */
export const ROUTE_DECISION_TOOL = {
	type: "function" as const,
	function: {
		name: "route_decision",
		description: "Route the conversation and extract any values the user provided.",
		parameters: {
			type: "object",
			properties: {
				action: {
					type: "string",
					enum: [
						"respond",
						"handbuch_nachschlagen",
						"schadensmeldung",
						"teams_nachricht",
						"schichtleiter_hinzuziehen",
						"complete",
					],
					description: "Selected route.",
				},
				response: {
					anyOf: [{ type: "string" }, { type: "null" }],
					description: "Spoken response to the user.",
				},
				extractedInputs: {
					type: "object",
					description: "Values the user provided in THIS message.",
					properties: {
						customerIntent: {
							anyOf: [{ type: "string" }, { type: "null" }],
							description:
								"Das KONKRETE Anliegen des Mitarbeiters, IMMER auf Deutsch zusammengefasst.",
						},
						customerLanguage: {
							anyOf: [{ type: "string" }, { type: "null" }],
							description:
								"Die Sprache, in der der Mitarbeiter GERADE spricht, mit DEUTSCHER Bezeichnung.",
						},
						schadenArt: {
							anyOf: [{ type: "string" }, { type: "null" }],
							description: "Was beschaedigt ist, DEUTSCH, max 4 Woerter.",
						},
						schadenSchwere: {
							anyOf: [{ type: "string" }, { type: "null" }],
							description: "'gering', 'mittel' oder 'kritisch'.",
						},
						schadenOrt: {
							anyOf: [{ type: "string" }, { type: "null" }],
							description: "Regal / Station / Linie.",
						},
						teamsTitle: {
							anyOf: [{ type: "string" }, { type: "null" }],
							description: "Kurzer deutscher Betreff, max 6 Woerter.",
						},
						teamsBody: {
							anyOf: [{ type: "string" }, { type: "null" }],
							description: "Meldungstext auf Deutsch, 1-3 kurze Saetze.",
						},
						teamsUrgency: {
							anyOf: [{ type: "string" }, { type: "null" }],
							description: "'niedrig', 'mittel' oder 'hoch'.",
						},
					},
				},
				awaitResponse: {
					anyOf: [{ type: "boolean" }, { type: "null" }],
					description: "True when your response expects a reply.",
				},
				options: {
					anyOf: [
						{
							type: "array",
							items: {
								type: "object",
								properties: {
									id: { type: "string" },
									label: { type: "string" },
								},
								required: ["id", "label"],
							},
						},
						{ type: "null" },
					],
					description: "Up to 3 tappable reply options.",
				},
			},
			required: ["action", "response"],
		},
	},
};

const SYSTEM_PROMPT = `Du bist Ava, mehrsprachige Dolmetscher-Assistentin im Lager / in der Produktion. Die Mitarbeiter sprechen oft kein Deutsch.

SPRACHE
Antworte IMMER in der Sprache, in der der Mitarbeiter GERADE schreibt oder spricht. Frage NIE nach der Sprache.

STIL
Keine Floskeln, keine Ankuendigungen, keine Wiederholung. Beim Routen nicht ankuendigen, was du tust - tu es.

GRENZEN
Erfinde nichts: keine Abteilungen, Zustaendigkeiten, Prozesse oder Zahlen, die du nicht sicher weisst.

Du nimmst das Anliegen auf, hilfst direkt wo du kannst, und waehlst sonst den passenden Weg.

DAS BEANTWORTEST DU SELBST: Schichtzeiten (Frueh 6:00-14:00, Spaet 14:00-22:00, Nacht 22:00-6:00); Pausen laut Schichtplan.

GROUNDING RULE (MANDATORY):
"extractedInputs" MUST ONLY contain values the user explicitly provided in their LATEST message.

TEXT FORMAT:
Your "response" is displayed as text. Use digits and concise formatting.

INPUT VARIABLE STATUS:
✗ Still needed (2 REQUIRED — you CANNOT route until ALL are filled):
→ ASK NOW: schadenArt — Was beschaedigt oder gestoert ist, auf Deutsch, max 4 Woerter.
  ○ schadenSchwere — Schweregrad: 'gering', 'mittel' oder 'kritisch'.
→ YOU WRITE THESE YOURSELF — never ask the user for them:
  • teamsTitle — Kurzer deutscher Betreff der Teams-Meldung.
  • teamsBody — Meldungstext auf Deutsch, 1-3 kurze Saetze.

RESPONSE FORMAT:
You MUST call the route_decision tool every turn.`;

export interface AgenticScenario {
	name: string;
	/** Needs a model tagged `vision` in the catalogue. */
	needsVision: boolean;
	messages: ChatMessage[];
}

export function agenticScenarios(): AgenticScenario[] {
	const photo = benchmarkPhoto();
	const scenarios: AgenticScenario[] = [
		{
			name: "text-turn",
			needsVision: false,
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: "Die Palette in Regal B12 ist gebrochen." },
			],
		},
		{
			name: "multilingual-turn",
			needsVision: false,
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{
					role: "user",
					content: "Paleta w regale B12 jest zlamana, co mam teraz zrobic?",
				},
			],
		},
	];

	if (photo) {
		scenarios.push({
			name: "photo-turn",
			needsVision: true,
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{
					role: "user",
					content: "",
					contentParts: [
						{ type: "text", text: "" },
						{ type: "image", mimeType: photo.mimeType, data: photo.data },
					],
				},
			],
		});
	} else {
		console.error(
			"[bench] no benchmark image found — photo-turn skipped. " +
				"Set AICO_BENCH_IMAGE or add assets/benchmark/glove-photo.jpg.",
		);
	}

	return scenarios;
}
