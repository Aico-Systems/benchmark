/**
 * AICO Backend Client
 * 
 * HTTP client for communicating with backend LLM routes
 */

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface ChatOptions {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
}

export interface ChatResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    finishReason?: string;
    timing: {
        startTime: number;
        endTime: number;
        latencyMs: number;
    };
    provider: string;
    model: string;
}

export interface StreamEvent {
    delta?: string;
    isComplete?: boolean;
    finishReason?: string;
    type?: "done" | "error";
    timing?: {
        startTime: number;
        firstTokenTime: number | null;
        endTime: number;
        ttftMs: number | null;
        latencyMs: number;
    };
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    provider?: string;
    model?: string;
    error?: string;
}

export interface ProviderInfo {
    key: string;
    name: string;
    type: string;
    config?: Record<string, any>;
}

export class AicoClient {
    private baseUrl: string;
    private organizationId?: string;

    constructor(baseUrl: string, organizationId?: string) {
        // Use /dev/ prefix for dev mode auth bypass
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.organizationId = organizationId;
    }

    private get headers(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.organizationId) {
            headers["X-Dev-Organization-Id"] = this.organizationId;
        }
        return headers;
    }

    /**
     * Get list of enabled LLM providers for the organization
     */
    async getProviders(): Promise<ProviderInfo[]> {
        const res = await fetch(
            `${this.baseUrl}/dev/api/organizations/current/providers?type=llm`,
            { headers: this.headers }
        );

        if (!res.ok) {
            throw new Error(`Failed to get providers: ${res.status} ${await res.text()}`);
        }

        const data = await res.json();
        // API returns array with nested provider object
        return data.map((item: any) => ({
            key: item.provider?.key,
            name: item.provider?.name,
            type: item.provider?.type,
            config: item.config,
        }));
    }

    /**
     * Non-streaming chat completion
     */
    async chat(
        provider: string,
        messages: ChatMessage[],
        options?: ChatOptions
    ): Promise<ChatResponse> {
        const res = await fetch(`${this.baseUrl}/dev/api/llm/chat`, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({ provider, messages, options }),
        });

        if (!res.ok) {
            throw new Error(`Chat failed: ${res.status} ${await res.text()}`);
        }

        return res.json();
    }

    /**
     * Streaming chat completion - returns async generator of events
     */
    async *stream(
        provider: string,
        messages: ChatMessage[],
        options?: ChatOptions
    ): AsyncGenerator<StreamEvent> {
        const res = await fetch(`${this.baseUrl}/dev/api/llm/stream`, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({ provider, messages, options }),
        });

        if (!res.ok) {
            throw new Error(`Stream failed: ${res.status} ${await res.text()}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const event = JSON.parse(line.slice(6));
                        yield event;
                    } catch {
                        // Skip malformed events
                    }
                }
            }
        }
    }
}
