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
import { AicoClient } from "./client";
import { BenchmarkRunner, type BenchmarkConfig } from "./runner";
import { getPrompts } from "./prompts";
import * as consoleReporter from "./reporters/console";
import { generateJsonReport } from "./reporters/json";
import { generateMarkdownReport } from "./reporters/markdown";
import type { BenchmarkResult, AggregateStats } from "./metrics";

const program = new Command();

program
    .name("benchmark")
    .description("AICO LLM Provider Benchmark Suite")
    .version("1.0.0")
    .option("-u, --url <url>", "Backend URL", process.env.AICO_BACKEND_URL || "http://localhost:3000")
    .option("-o, --org <id>", "Organization ID", process.env.AICO_ORGANIZATION_ID)
    .option("-p, --provider <name>", "Test specific provider only")
    .option("-P, --prompts <category>", "Prompt category: simple, reasoning, coding, all", "simple")
    .option("-i, --iterations <n>", "Number of iterations per prompt", "3")
    .option("-s, --streaming", "Use streaming endpoint", false)
    .option("-f, --format <type>", "Output format: console, json, markdown", "console")
    .option("-v, --verbose", "Show individual iteration results", false)
    .parse();

const opts = program.opts();

async function main() {
    const client = new AicoClient(opts.url, opts.org);
    const runner = new BenchmarkRunner(client);

    const prompts = getPrompts(opts.prompts);
    const providers = opts.provider ? [opts.provider] : undefined;

    const config: BenchmarkConfig = {
        providers,
        iterations: parseInt(opts.iterations) || 3,
        streaming: opts.streaming,
        prompts,
    };

    const rawResults: BenchmarkResult[] = [];

    // Only show console output if format is console
    const isConsole = opts.format === "console";

    if (isConsole) {
        consoleReporter.printHeader();
        console.log(`Backend: ${opts.url}`);
        console.log(`Prompts: ${opts.prompts} (${prompts.length} prompts)`);
        console.log(`Iterations: ${config.iterations}`);
        console.log(`Streaming: ${config.streaming}`);
    }

    const stats = await runner.run(config, {
        onProviderStart: (provider) => {
            if (isConsole) consoleReporter.printProviderStart(provider);
        },
        onIterationComplete: (result) => {
            rawResults.push(result);
            if (isConsole && opts.verbose) {
                consoleReporter.printIterationResult(result);
            }
        },
        onProviderComplete: (provider, stats) => {
            if (isConsole) consoleReporter.printProviderStats(stats);
        },
        onError: (provider, error) => {
            if (isConsole) console.error(`  ✗ Error: ${error.message}`);
        },
    });

    // Output results
    switch (opts.format) {
        case "json":
            console.log(generateJsonReport(
                stats,
                { iterations: config.iterations, streaming: config.streaming, prompts: prompts.map(p => p.name) },
                opts.verbose,
                opts.verbose ? rawResults : undefined
            ));
            break;

        case "markdown":
            console.log(generateMarkdownReport(stats));
            break;

        case "console":
        default:
            consoleReporter.printSummary(stats);
            break;
    }
}

main().catch((err) => {
    console.error("Benchmark failed:", err);
    process.exit(1);
});
