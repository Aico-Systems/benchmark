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

export const reitPrompts: PromptConfig[] = [
	{
		name: "reit_damage_collection",
		messages: [
			{
				role: "system",
				content:
					'Du sammelst Schadensinformationen.\n\nFRAGEN in dieser Reihenfolge:\n1. Schadensart (Was ist passiert?)\n2. Fahrzeug (Hersteller, Modell, Kennzeichen - gerne kombinieren)\n3. Selbst schuld?\n4. Verkehrssicher? (Beleuchtung, Spiegel ok? Keine scharfen Kanten?)\n5. Versicherung\n6. Schon gemeldet? Falls ja: Schadennummer? (optional)\n\nWICHTIG zu selbst_schuld:\n- "Ja"/"Ich wars"/"Meine Schuld" -> selbst_schuld=true, weiter sammeln\n- "Nein"/"Nicht schuld"/"Der andere"/"Wurde angefahren" -> action=konsultation_fremdverschulden\n\nWenn fahrbereit=false -> action=konsultation_mitarbeiter\n\nMaximal zwei Fragen pro Nachricht. Verwandte Fragen kombinieren.',
			},
			{
				role: "user",
				content:
					"Hallo, ich hatte gestern einen Unfall. Jemand ist mir beim Ausparken reingefahren. Mein Auto ist ein BMW 3er mit dem Kennzeichen N-AB-123. Ich bin nicht schuld, der andere hat es auch zugegeben. Das Auto fährt noch, aber der Scheinwerfer vorne links ist kaputt. Ich habe es meiner Versicherung, der Allianz, noch nicht gemeldet.",
			},
		],
		options: { maxTokens: 500 },
	},
];

export const allPrompts: Record<string, PromptConfig[]> = {
	simple: simplePrompts,
	reasoning: reasoningPrompts,
	coding: codingPrompts,
	reit: reitPrompts,
};

export function getPrompts(category?: string): PromptConfig[] {
	if (!category || category === "all") {
		return [
			...simplePrompts,
			...reasoningPrompts,
			...codingPrompts,
			...reitPrompts,
		];
	}
	return allPrompts[category] || simplePrompts;
}
