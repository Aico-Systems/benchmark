/**
 * Benchmark Runner
 *
 * Orchestrates benchmark execution across providers
 */

import { AicoClient, type ChatMessage } from "./client";
import {
	type BenchmarkResult,
	type AggregateStats,
	calculateStats,
} from "./metrics";

export interface BenchmarkConfig {
	providers?: string[]; // Empty = all enabled providers
	iterations: number;
	streaming: boolean;
	prompts: PromptConfig[];
}

export interface PromptConfig {
	name: string;
	messages: ChatMessage[];
	options?: {
		model?: string;
		temperature?: number;
		maxTokens?: number;
		effort?: "low" | "medium" | "high";
		thinkingLevel?: "LOW" | "MEDIUM" | "HIGH";
	};
}

export interface RunnerCallbacks {
	onProviderStart?: (provider: string) => void;
	onProviderComplete?: (provider: string, stats: AggregateStats) => void;
	onIterationComplete?: (provider: string, result: BenchmarkResult) => void;
	onModelSkipped?: (provider: string, model: string, reason: string) => void;
	onError?: (provider: string, error: Error) => void;
}

/** Check if an error indicates the model doesn't exist or isn't accessible */
function isModelNotAvailable(error: unknown): boolean {
	const msg = error instanceof Error ? error.message : String(error);
	return /does not exist|not found|no access|not available|model_not_found|404/i.test(
		msg,
	);
}

export class BenchmarkRunner {
	private client: AicoClient;

	constructor(client: AicoClient) {
		this.client = client;
	}

	/**
	 * Run benchmarks and return aggregated results
	 */
	async run(
		config: BenchmarkConfig,
		callbacks?: RunnerCallbacks,
	): Promise<Map<string, AggregateStats>> {
		let providers = config.providers || [];
		if (providers.length === 0) {
			const allProviders = await this.client.getProviders();
			providers = allProviders.map((p) => p.key);
		}

		const allStats = new Map<string, AggregateStats>();

		for (const provider of providers) {
			callbacks?.onProviderStart?.(provider);

			const results: BenchmarkResult[] = [];

			for (const prompt of config.prompts) {
				for (let i = 0; i < config.iterations; i++) {
					try {
						const result = await this.runSingle(
							provider,
							prompt,
							i + 1,
							config.streaming,
						);
						results.push(result);
						callbacks?.onIterationComplete?.(provider, result);
					} catch (error) {
						const failedResult: BenchmarkResult = {
							provider,
							model: "unknown",
							prompt: prompt.name,
							iteration: i + 1,
							latencyMs: 0,
							responseLength: 0,
							success: false,
							error: error instanceof Error ? error.message : String(error),
						};
						results.push(failedResult);
						callbacks?.onError?.(provider, error as Error);
					}
				}
			}

			if (results.length > 0) {
				const stats = calculateStats(results);
				allStats.set(provider, stats);
				callbacks?.onProviderComplete?.(provider, stats);
			}
		}

		return allStats;
	}

	/**
	 * Run benchmark across all providers and all of their available models.
	 * Models that return 404/not-found are silently skipped.
	 */
	async runAcrossAllModels(
		config: BenchmarkConfig,
		callbacks?: RunnerCallbacks,
	): Promise<Map<string, AggregateStats>> {
		const allStats = new Map<string, AggregateStats>();
		const providers = await this.client.getProviders();

		const enabledProviders =
			config.providers && config.providers.length > 0
				? providers.filter((p) => config.providers!.includes(p.key))
				: providers;

		for (const providerInfo of enabledProviders) {
			callbacks?.onProviderStart?.(providerInfo.key);

			for (const model of providerInfo.models) {
				const results: BenchmarkResult[] = [];
				const providerModelKey = `${providerInfo.key}:${model}`;
				let modelSkipped = false;

				for (let i = 0; i < config.iterations && !modelSkipped; i++) {
					for (const prompt of config.prompts) {
						try {
							const promptWithModel: PromptConfig = {
								...prompt,
								options: { ...prompt.options, model },
							};

							const result = await this.runSingle(
								providerInfo.key,
								promptWithModel,
								i + 1,
								config.streaming,
							);
							results.push(result);
							callbacks?.onIterationComplete?.(providerModelKey, result);
						} catch (error) {
							// Skip entire model if it doesn't exist / no access
							if (isModelNotAvailable(error)) {
								callbacks?.onModelSkipped?.(
									providerInfo.key,
									model,
									error instanceof Error ? error.message : String(error),
								);
								modelSkipped = true;
								break;
							}

							const failedResult: BenchmarkResult = {
								provider: providerInfo.key,
								model,
								prompt: prompt.name,
								iteration: i + 1,
								latencyMs: 0,
								responseLength: 0,
								success: false,
								error: error instanceof Error ? error.message : String(error),
							};
							results.push(failedResult);
							callbacks?.onError?.(providerModelKey, error as Error);
						}
					}
				}

				if (!modelSkipped && results.length > 0) {
					const stats = calculateStats(results);
					allStats.set(providerModelKey, stats);
					callbacks?.onProviderComplete?.(providerModelKey, stats);
				}
			}
		}

		return allStats;
	}

	/**
	 * Run a single benchmark iteration
	 */
	private async runSingle(
		provider: string,
		prompt: PromptConfig,
		iteration: number,
		streaming: boolean,
	): Promise<BenchmarkResult> {
		if (streaming) {
			return this.runStreaming(provider, prompt, iteration);
		}
		return this.runNonStreaming(provider, prompt, iteration);
	}

	private async runNonStreaming(
		provider: string,
		prompt: PromptConfig,
		iteration: number,
	): Promise<BenchmarkResult> {
		const response = await this.client.chat(
			provider,
			prompt.messages,
			prompt.options,
		);

		const tokensPerSecond =
			response.usage?.completionTokens && response.timing.latencyMs > 0
				? (response.usage.completionTokens / response.timing.latencyMs) * 1000
				: undefined;

		return {
			provider: response.provider,
			model: response.model,
			prompt: prompt.name,
			iteration,
			latencyMs: response.timing.latencyMs,
			promptTokens: response.usage?.promptTokens,
			completionTokens: response.usage?.completionTokens,
			totalTokens: response.usage?.totalTokens,
			tokensPerSecond,
			responseLength: response.content?.length || 0,
			responseContent: response.content,
			messages: prompt.messages,
			success: true,
		};
	}

	private async runStreaming(
		provider: string,
		prompt: PromptConfig,
		iteration: number,
	): Promise<BenchmarkResult> {
		let responseContent = "";
		let finalEvent: any = null;

		for await (const event of this.client.stream(
			provider,
			prompt.messages,
			prompt.options,
		)) {
			if (event.delta) {
				responseContent += event.delta;
			}
			if (event.type === "done") {
				finalEvent = event;
			}
			if (event.type === "error") {
				throw new Error(event.error);
			}
		}

		if (!finalEvent) {
			throw new Error("Stream ended without final event");
		}

		const tokensPerSecond =
			finalEvent.usage?.completionTokens && finalEvent.timing?.latencyMs > 0
				? (finalEvent.usage.completionTokens / finalEvent.timing.latencyMs) *
					1000
				: undefined;

		return {
			provider: finalEvent.provider,
			model: finalEvent.model,
			prompt: prompt.name,
			iteration,
			latencyMs: finalEvent.timing.latencyMs,
			ttftMs: finalEvent.timing.ttftMs,
			promptTokens: finalEvent.usage?.promptTokens,
			completionTokens: finalEvent.usage?.completionTokens,
			totalTokens: finalEvent.usage?.totalTokens,
			tokensPerSecond,
			responseLength: responseContent.length,
			responseContent,
			messages: prompt.messages,
			success: true,
		};
	}
}
