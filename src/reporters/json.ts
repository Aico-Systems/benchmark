/**
 * JSON Reporter
 */

import type { AggregateStats, BenchmarkResult } from "../metrics";

export interface JsonReport {
    timestamp: string;
    config: {
        iterations: number;
        streaming: boolean;
        prompts: string[];
    };
    results: Map<string, AggregateStats> | object;
    raw?: BenchmarkResult[];
}

export function generateJsonReport(
    stats: Map<string, AggregateStats>,
    config: { iterations: number; streaming: boolean; prompts: string[] },
    includeRaw = false,
    rawResults?: BenchmarkResult[]
): string {
    const report: JsonReport = {
        timestamp: new Date().toISOString(),
        config,
        results: Object.fromEntries(stats),
        ...(includeRaw && rawResults ? { raw: rawResults } : {}),
    };

    return JSON.stringify(report, null, 2);
}
