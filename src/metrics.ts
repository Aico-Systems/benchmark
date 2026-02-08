/**
 * Metrics Collection and Statistics
 */
import type { ChatMessage } from "./client";

export interface BenchmarkResult {
    provider: string;
    model: string;
    prompt: string;
    iteration: number;

    // Timing metrics
    latencyMs: number;
    ttftMs?: number;  // Time to first token (streaming only)

    // Token metrics  
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    tokensPerSecond?: number;

    // Response
    responseLength: number;
    responseContent?: string;
    messages?: ChatMessage[];
    success: boolean;
    error?: string;
}

export interface AggregateStats {
    provider: string;
    model: string;
    iterations: number;

    latency: {
        min: number;
        max: number;
        mean: number;
        median: number;
        p95: number;
        stdDev: number;
    };

    ttft?: {
        min: number;
        max: number;
        mean: number;
        median: number;
    };

    tokens: {
        avgPrompt: number;
        avgCompletion: number;
        avgTotal: number;
        avgTokensPerSecond: number;
    };

    avgResponseLength: number;
    successRate: number;
}

/**
 * Calculate statistics from benchmark results
 */
export function calculateStats(results: BenchmarkResult[]): AggregateStats {
    if (results.length === 0) {
        throw new Error("No results to calculate stats");
    }

    const successful = results.filter(r => r.success);
    const latencies = successful.map(r => r.latencyMs).sort((a, b) => a - b);
    const ttfts = successful.filter(r => r.ttftMs != null).map(r => r.ttftMs!).sort((a, b) => a - b);

    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const median = (arr: number[]) => {
        const mid = Math.floor(arr.length / 2);
        return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
    };
    const percentile = (arr: number[], p: number) => {
        const idx = Math.ceil((p / 100) * arr.length) - 1;
        return arr[Math.max(0, idx)];
    };
    const stdDev = (arr: number[], avg: number) => {
        const variance = arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / arr.length;
        return Math.sqrt(variance);
    };

    const latencyMean = mean(latencies);

    return {
        provider: results[0].provider,
        model: results[0].model,
        iterations: results.length,

        latency: {
            min: Math.min(...latencies),
            max: Math.max(...latencies),
            mean: latencyMean,
            median: median(latencies),
            p95: percentile(latencies, 95),
            stdDev: stdDev(latencies, latencyMean),
        },

        ttft: ttfts.length > 0 ? {
            min: Math.min(...ttfts),
            max: Math.max(...ttfts),
            mean: mean(ttfts),
            median: median(ttfts),
        } : undefined,

        tokens: {
            avgPrompt: mean(successful.map(r => r.promptTokens || 0)),
            avgCompletion: mean(successful.map(r => r.completionTokens || 0)),
            avgTotal: mean(successful.map(r => r.totalTokens || 0)),
            avgTokensPerSecond: mean(successful.filter(r => r.tokensPerSecond).map(r => r.tokensPerSecond!)),
        },
        avgResponseLength: results.reduce((a, b) => a + b.responseLength, 0) / results.length,
        successRate: successful.length / results.length,
    };
}
