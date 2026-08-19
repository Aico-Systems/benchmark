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

## Agentic-turn benchmark (the one that matters)

The prompts above measure requests AICO never makes. A real turn is a forced
tool call against a ~4 kB `route_decision` schema, often with a photo attached,
and models rank very differently on that:

```bash
bun src/agenticBench.ts                       # every catalogued chat model
bun src/agenticBench.ts --vision-only         # just the photo turn
bun src/agenticBench.ts --models openai:gpt-5.6-luna,groq:openai/gpt-oss-120b
bun src/agenticBench.ts --iterations 5 -f json
```

Reports the median of N runs (provider latency is long-tailed — a mean hides
behind one cold start), plus $/1k turns computed from catalogue pricing and
real token usage. Latest results: `results/agentic-2026-08-05.md`.

The photo turn needs a real, decodable image — `assets/benchmark/glove-photo.jpg`
by default, override with `AICO_BENCH_IMAGE`. If none is found the photo turn is
skipped rather than faked.

## Configuration

Create a `.env` file (copy from `.env.example`):

```bash
# Backend URL (use /dev/ prefix for dev mode auth bypass)
AICO_BACKEND_URL=http://localhost:8000

# Organization ID (optional - uses default dev org if empty)
AICO_ORGANIZATION_ID=
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-u, --url <url>` | Backend URL | `http://localhost:8000` |
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
