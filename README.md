# AICO LLM Provider Benchmark Suite

Benchmark tool for comparing LLM provider performance across latency, throughput, and reliability.

## Quick Start

```bash
# Install dependencies
bun install

# Run benchmark (all providers, simple prompts)
bun run benchmark

# Test specific provider
bun run benchmark --provider openai

# Use different prompt category
bun run benchmark --prompts reasoning  # simple | reasoning | coding | all

# Multiple iterations for statistical significance
bun run benchmark --iterations 5

# Use streaming endpoint for TTFT measurement
bun run benchmark --streaming

# Output as markdown report
bun run benchmark --format markdown > report.md

# Output as JSON
bun run benchmark --format json > results.json
```

## Configuration

Create a `.env` file (copy from `.env.example`):

```bash
# Backend URL (use /dev/ prefix for dev mode auth bypass)
AICO_BACKEND_URL=http://localhost:3000

# Organization ID (optional - uses default dev org if empty)
AICO_ORGANIZATION_ID=
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-u, --url <url>` | Backend URL | `http://localhost:3000` |
| `-o, --org <id>` | Organization ID | env or default |
| `-p, --provider <name>` | Test specific provider | all enabled |
| `-P, --prompts <category>` | Prompt category | `simple` |
| `-i, --iterations <n>` | Iterations per prompt | `3` |
| `-s, --streaming` | Use streaming endpoint | `false` |
| `-f, --format <type>` | Output format | `console` |
| `-v, --verbose` | Show individual results | `false` |

## Metrics

- **Latency**: Total request time (ms)
- **TTFT**: Time to first token (streaming only)
- **Tokens/s**: Output throughput
- **Success Rate**: Percentage of successful calls

## Adding Custom Prompts

Edit `src/prompts.ts` to add custom benchmark prompts.
