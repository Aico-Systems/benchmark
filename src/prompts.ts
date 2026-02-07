/**
 * Standard Benchmark Prompts
 */

import type { PromptConfig } from "./runner";

export const simplePrompts: PromptConfig[] = [
    {
        name: "simple_greeting",
        messages: [
            { role: "user", content: "Hello! How are you today?" }
        ],
        options: { maxTokens: 100 },
    },
    {
        name: "simple_factual",
        messages: [
            { role: "user", content: "What is the capital of France?" }
        ],
        options: { maxTokens: 50 },
    },
];

export const reasoningPrompts: PromptConfig[] = [
    {
        name: "reasoning_math",
        messages: [
            {
                role: "user",
                content: "If a train travels at 60 mph for 2.5 hours, then at 80 mph for 1.5 hours, what is the total distance traveled?"
            }
        ],
        options: { maxTokens: 200 },
    },
    {
        name: "reasoning_logic",
        messages: [
            {
                role: "user",
                content: "There are 5 houses in a row, each painted a different color. The order is: red, blue, green, yellow, white. If the green house is in the middle, and the red house is first, what position is the blue house?"
            }
        ],
        options: { maxTokens: 200 },
    },
];

export const codingPrompts: PromptConfig[] = [
    {
        name: "coding_function",
        messages: [
            {
                role: "user",
                content: "Write a TypeScript function that reverses a string without using the built-in reverse() method."
            }
        ],
        options: { maxTokens: 300 },
    },
    {
        name: "coding_algorithm",
        messages: [
            {
                role: "user",
                content: "Implement a binary search function in TypeScript that returns the index of a target value in a sorted array, or -1 if not found."
            }
        ],
        options: { maxTokens: 400 },
    },
];

export const allPrompts: Record<string, PromptConfig[]> = {
    simple: simplePrompts,
    reasoning: reasoningPrompts,
    coding: codingPrompts,
};

export function getPrompts(category?: string): PromptConfig[] {
    if (!category || category === "all") {
        return [...simplePrompts, ...reasoningPrompts, ...codingPrompts];
    }
    return allPrompts[category] || simplePrompts;
}
