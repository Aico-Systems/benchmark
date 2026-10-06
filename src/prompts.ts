/**
 * Standard Benchmark Prompts
 */

import type { PromptConfig } from "./runner";

export const simplePrompts: PromptConfig[] = [
	{
		name: "simple_greeting",
		messages: [{ role: "user", content: "Hello! How are you today?" }],
		options: { maxTokens: 100 },
	},
	{
		name: "simple_factual",
		messages: [{ role: "user", content: "What is the capital of France?" }],
		options: { maxTokens: 50 },
	},
];

export const reasoningPrompts: PromptConfig[] = [
	{
		name: "reasoning_math",
		messages: [
			{
				role: "user",
				content:
					"If a train travels at 60 mph for 2.5 hours, then at 80 mph for 1.5 hours, what is the total distance traveled?",
			},
		],
		options: { maxTokens: 200 },
	},
	{
		name: "reasoning_thinking_logic",
		messages: [
			{
				role: "user",
				content:
					"A box contains 5 red balls, 4 blue balls, and 3 green balls. If you draw 3 balls at once, what is the probability of getting exactly one of each color? Show your thinking.",
			},
		],
		options: { maxTokens: 4000, effort: "high", thinkingLevel: "HIGH" },
	},
	{
		name: "reasoning_complex_logic",
		messages: [
			{
				role: "user",
				content:
					"There are 5 houses in a row, each painted a different color. The order is: red, blue, green, yellow, white. If the green house is in the middle, and the red house is first, what position is the blue house? Explain step-by-step.",
			},
		],
		options: { maxTokens: 1000, effort: "medium", thinkingLevel: "MEDIUM" },
	},
];

export const codingPrompts: PromptConfig[] = [
	{
		name: "coding_function",
		messages: [
			{
				role: "user",
				content:
					"Write a TypeScript function that reverses a string without using the built-in reverse() method.",
			},
		],
		options: { maxTokens: 300 },
	},
	{
		name: "coding_thinking_algorithm",
		messages: [
			{
				role: "user",
				content:
					"Implement a robust, generic binary search function in TypeScript with comprehensive error handling and O(log n) efficiency. Explain the algorithm's complexity and edge cases.",
			},
		],
		options: { maxTokens: 5000, effort: "high", thinkingLevel: "HIGH" },
	},
];

export const allPrompts: Record<string, PromptConfig[]> = {
	simple: simplePrompts,
	reasoning: reasoningPrompts,
	coding: codingPrompts,
};

export function getPrompts(category?: string): PromptConfig[] {
	if (!category || category === "all") {
		return [
			...simplePrompts,
			...reasoningPrompts,
			...codingPrompts,
		];
	}
	return allPrompts[category] || simplePrompts;
}
