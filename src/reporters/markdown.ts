/**
 * Markdown Reporter
 */

import type { AggregateStats } from "../metrics";

export function generateMarkdownReport(
    stats: Map<string, AggregateStats>
): string {
    const sorted = [...stats.entries()].sort(
        (a, b) => a[1].latency.mean - b[1].latency.mean
    );

    let md = `# LLM Provider Benchmark Report

**Generated:** ${new Date().toISOString()}

## Summary

| Provider | Model | Latency (avg) | Latency (p95) | TTFT | Tokens/s | Success |
|----------|-------|---------------|---------------|------|----------|---------|
`;

    for (const [provider, s] of sorted) {
        const ttft = s.ttft ? `${s.ttft.mean.toFixed(0)}ms` : "-";
        md += `| ${provider} | ${s.model} | ${s.latency.mean.toFixed(0)}ms | ${s.latency.p95.toFixed(0)}ms | ${ttft} | ${s.tokens.avgTokensPerSecond.toFixed(1)} | ${(s.successRate * 100).toFixed(0)}% |\n`;
    }

    md += `\n## Detailed Results\n\n`;

    for (const [provider, s] of sorted) {
        md += `### ${provider} (${s.model})

- **Iterations:** ${s.iterations}
- **Latency:** ${s.latency.mean.toFixed(0)}ms avg, ${s.latency.min.toFixed(0)}-${s.latency.max.toFixed(0)}ms range, ±${s.latency.stdDev.toFixed(0)}ms std
`;
        if (s.ttft) {
            md += `- **Time to First Token:** ${s.ttft.mean.toFixed(0)}ms avg\n`;
        }
        md += `- **Throughput:** ${s.tokens.avgTokensPerSecond.toFixed(1)} tokens/sec
- **Avg Tokens:** ${s.tokens.avgPrompt.toFixed(0)} prompt, ${s.tokens.avgCompletion.toFixed(0)} completion

`;
    }

    return md;
}
