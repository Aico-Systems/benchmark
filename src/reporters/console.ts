/**
 * Console Reporter
 */

import type { AggregateStats, BenchmarkResult } from "../metrics";

export function printHeader(): void {
    console.log("\n🚀 AICO LLM Provider Benchmark\n");
    console.log("=".repeat(60));
}

export function printProviderStart(provider: string): void {
    console.log(`\n📊 Testing ${provider}...`);
}

export function printIterationResult(result: BenchmarkResult): void {
    const status = result.success ? "✓" : "✗";
    const ttft = result.ttftMs ? ` TTFT: ${result.ttftMs}ms` : "";
    console.log(
        `  ${status} [${result.iteration}] ${result.latencyMs}ms${ttft}` +
        (result.tokensPerSecond ? ` (${result.tokensPerSecond.toFixed(1)} tok/s)` : "")
    );
}

export function printProviderStats(stats: AggregateStats): void {
    console.log(`\n  📈 ${stats.provider} (${stats.model})`);

    // Handle case where all iterations failed
    if (stats.successRate === 0 || !stats.latency?.mean) {
        console.log(`     ⚠️  All iterations failed`);
        console.log(`     Success: ${(stats.successRate * 100).toFixed(0)}%`);
        return;
    }

    console.log(`     Latency: ${stats.latency.mean.toFixed(0)}ms avg (p95: ${stats.latency.p95.toFixed(0)}ms)`);
    if (stats.ttft) {
        console.log(`     TTFT: ${stats.ttft.mean.toFixed(0)}ms avg`);
    }
    console.log(`     Tokens/s: ${stats.tokens.avgTokensPerSecond.toFixed(1)}`);
    console.log(`     Success: ${(stats.successRate * 100).toFixed(0)}%`);
}

export function printSummary(allStats: Map<string, AggregateStats>): void {
    console.log("\n" + "=".repeat(60));
    console.log("\n📊 SUMMARY\n");

    // Sort by latency
    const sorted = [...allStats.entries()].sort(
        (a, b) => a[1].latency.mean - b[1].latency.mean
    );

    const colWidths = { provider: 15, latency: 12, ttft: 10, tps: 12, success: 10 };

    console.log(
        "Provider".padEnd(colWidths.provider) +
        "Latency".padEnd(colWidths.latency) +
        "TTFT".padEnd(colWidths.ttft) +
        "Tok/s".padEnd(colWidths.tps) +
        "Success"
    );
    console.log("-".repeat(60));

    for (const [provider, stats] of sorted) {
        const ttft = stats.ttft ? `${stats.ttft.mean.toFixed(0)}ms` : "-";
        console.log(
            provider.padEnd(colWidths.provider) +
            `${stats.latency.mean.toFixed(0)}ms`.padEnd(colWidths.latency) +
            ttft.padEnd(colWidths.ttft) +
            `${stats.tokens.avgTokensPerSecond.toFixed(1)}`.padEnd(colWidths.tps) +
            `${(stats.successRate * 100).toFixed(0)}%`
        );
    }

    console.log("\n");
}
