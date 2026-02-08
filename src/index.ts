#!/usr/bin/env bun
/**
 * AICO LLM Provider Benchmark CLI
 *
 * Usage:
 *   bun run benchmark                          # Run all providers
 *   bun run benchmark --provider openai        # Specific provider
 *   bun run benchmark --prompts coding         # Specific prompt category
 *   bun run benchmark --format markdown        # Output format
 *   bun run benchmark --iterations 5           # Multiple iterations
 */

import { Command } from "commander";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { AicoClient } from "./client";
import {
	BenchmarkRunner,
	type BenchmarkConfig,
	type RunnerCallbacks,
} from "./runner";
import {
	simplePrompts,
	reasoningPrompts,
	codingPrompts,
	reitPrompts,
} from "./prompts";
import * as consoleReporter from "./reporters/console";
import { generateJsonReport } from "./reporters/json";
import { generateMarkdownReport } from "./reporters/markdown";
import type { BenchmarkResult, AggregateStats } from "./metrics";

const program = new Command();

program
	.name("benchmark")
	.description("AICO LLM Provider Benchmark Suite")
	.version("1.0.0")
	.option(
		"-u, --url <url>",
		"AICO Backend URL",
		process.env.AICO_BACKEND_URL || "http://localhost:5005",
	)
	.option("-o, --org <id>", "Organization ID", process.env.AICO_ORGANIZATION_ID)
	.option("-p, --provider <name>", "Test specific provider only")
	.option(
		"-a, --all-models",
		"Run benchmark across all models for all providers",
	)
	.option(
		"-t, --prompts <category>",
		"Prompt category (simple, reasoning, coding, all)",
		"all",
	)
	.option("-i, --iterations <number>", "Number of iterations per prompt", "1")
	.option("-s, --streaming", "Use streaming inference", false)
	.option(
		"-f, --format <type>",
		"Output format (console, json, markdown)",
		"console",
	)
	.option("-v, --verbose", "Show detailed iteration results", false)
	.parse(process.argv);

const opts = program.opts();

async function main() {
	const client = new AicoClient(opts.url, opts.org);
	const runner = new BenchmarkRunner(client);

	const prompts =
		opts.prompts === "all"
			? [
					...simplePrompts,
					...reasoningPrompts,
					...codingPrompts,
					...reitPrompts,
				]
			: opts.prompts === "simple"
				? simplePrompts
				: opts.prompts === "reasoning"
					? reasoningPrompts
					: opts.prompts === "reit"
						? reitPrompts
						: codingPrompts;

	// Only show console output if format is console
	const isConsole = opts.format === "console";

	if (isConsole) {
		consoleReporter.printHeader();
		console.log(`Backend: ${opts.url}`);
		console.log(`Prompts: ${opts.prompts} (${prompts.length} prompts)`);
		console.log(`Iterations: ${opts.iterations}`);
	}

	const allStats = new Map<string, AggregateStats>();
	const allRawResults: BenchmarkResult[] = [];

	// Define modes to run
	const modes = opts.allModels ? [false, true] : [opts.streaming];

	for (const streaming of modes) {
		const modeLabel = streaming ? "Streaming" : "Static";
		if (isConsole) console.log(`\n▶ Starting ${modeLabel} Evaluation...`);

		const config: BenchmarkConfig = {
			providers: opts.provider ? [opts.provider] : [],
			iterations: parseInt(opts.iterations),
			streaming,
			prompts,
		};

		const callbacks: RunnerCallbacks = {
			onProviderStart: (provider) => {
				if (isConsole)
					consoleReporter.printProviderStart(`${provider} (${modeLabel})`);
			},
			onIterationComplete: (provider, result) => {
				// Add mode to provider key for uniqueness in aggregate stats
				allRawResults.push(result);
				if (isConsole && opts.verbose) {
					consoleReporter.printIterationResult(result);
				}
			},
			onProviderComplete: (provider, stats) => {
				if (isConsole) consoleReporter.printProviderStats(stats);
			},
			onModelSkipped: (provider, model, reason) => {
				if (isConsole)
					console.log(`  ⊘ Skipped [${provider}:${model}] (not available)`);
			},
			onError: (provider, error) => {
				if (isConsole)
					console.error(`  ✗ Error [${provider}]: ${error.message}`);
			},
		};

		const modeStats = opts.allModels
			? await runner.runAcrossAllModels(config, callbacks)
			: await runner.run(config, callbacks);

		// Store results with mode-specific keys
		for (const [key, stats] of modeStats.entries()) {
			allStats.set(`${key}:${streaming ? "streaming" : "static"}`, stats);
		}
	}

	// Generate structured results
	const resultsDir = path.join(process.cwd(), "results");
	await mkdir(resultsDir, { recursive: true });

	// Save individual results
	for (const [key, aggregate] of allStats.entries()) {
		const [provider, model, mode] = key.split(":");
		const providerDir = path.join(resultsDir, provider);
		await mkdir(providerDir, { recursive: true });

		const isStreaming = mode === "streaming";
		const modelResults = allRawResults.filter(
			(r) =>
				r.provider === provider &&
				r.model === model &&
				((isStreaming && r.ttftMs != null) ||
					(!isStreaming && r.ttftMs == null)),
		);

		const report = generateJsonReport(
			new Map([[key, aggregate]]),
			{
				iterations: parseInt(opts.iterations),
				streaming: isStreaming,
				prompts: prompts.map((p: any) => p.name),
			},
			true,
			modelResults,
		);

		await writeFile(
			path.join(providerDir, `${model.replace(/\//g, "_")}_${mode}.json`),
			report,
		);
	}

	// Generate summary ranking
	const summaryPath = path.join(resultsDir, "summary.md");
	let summaryMd = "# Benchmark Summary & Model Rankings\n\n";
	summaryMd += `Date: ${new Date().toLocaleString()}\n`;
	summaryMd += `Iterations: ${opts.iterations}\n\n`;

	summaryMd += "## Performance Ranking (Avg Latency)\n\n";
	summaryMd +=
		"| Rank | Model | Mode | Avg Latency | Avg TTFT | Response Length |\n";
	summaryMd +=
		"|------|-------|------|-------------|----------|-----------------|\n";

	const sortedSummaries = Array.from(allStats.entries())
		.map(([key, stats]) => {
			const [provider, model, mode] = key.split(":");
			return { provider, model, mode, stats };
		})
		.sort((a, b) => (a.stats.latency.mean || 0) - (b.stats.latency.mean || 0));

	sortedSummaries.forEach((item, index) => {
		const ttft = item.stats.ttft
			? `${item.stats.ttft.mean.toFixed(2)}ms`
			: "N/A";
		summaryMd += `| ${index + 1} | ${item.provider}:${item.model} | ${item.mode} | ${item.stats.latency.mean.toFixed(2)}ms | ${ttft} | ${item.stats.avgResponseLength.toFixed(0)} chars |\n`;
	});

	await writeFile(summaryPath, summaryMd);
	if (isConsole) console.log(`\n✅ Results saved to ${resultsDir}`);

	// Output final results to console if format is not console
	if (!isConsole) {
		switch (opts.format) {
			case "json":
				console.log(
					generateJsonReport(
						allStats,
						{
							iterations: parseInt(opts.iterations),
							streaming: opts.streaming,
							prompts: prompts.map((p: any) => p.name),
						},
						opts.verbose,
						opts.verbose ? allRawResults : undefined,
					),
				);
				break;

			case "markdown":
				console.log(generateMarkdownReport(allStats));
				break;
		}
	} else {
		consoleReporter.printSummary(allStats);
	}
}

main().catch((err) => {
	console.error("Benchmark failed:", err);
	process.exit(1);
});
