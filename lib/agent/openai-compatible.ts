import {
  joinEndpoint,
  parseToolArguments,
  sanitizeProviderError,
  type AssistantTurn,
  type ContentPart,
  type InternalMessage,
  type ProviderAdapter,
  type ProviderCompleteInput,
  type StopReason,
} from "@/lib/agent/types";

const DEFAULT_BASE = "https://api.openai.com/v1";

type OpenAIMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; tool_call_id: string; content: string };

export function toOpenAIRequest(input: ProviderCompleteInput): {
  messages: OpenAIMessage[];
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
} {
  const messages: OpenAIMessage[] = [];

  for (const message of input.messages) {
    if (message.role === "system" || message.role === "user") {
      const text = message.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      messages.push({ role: message.role, content: text });
      continue;
    }

    if (message.role === "tool") {
      for (const part of message.content) {
        if (part.type !== "tool_result") continue;
        messages.push({
          role: "tool",
          tool_call_id: part.toolCallId,
          content: part.content,
        });
      }
      continue;
    }

    const text = message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    const toolCalls = message.content
      .filter((part) => part.type === "tool_call")
      .map((part) => ({
        id: part.id,
        type: "function" as const,
        function: {
          name: part.name,
          arguments: JSON.stringify(part.arguments ?? {}),
        },
      }));

    messages.push({
      role: "assistant",
      content: text || null,
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    });
  }

  const tools =
    input.tools.length > 0
      ? input.tools.map((tool) => ({
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        }))
      : undefined;

  return { messages, tools };
}

export function fromOpenAIResponse(data: {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
}): AssistantTurn {
  const choice = data.choices?.[0];
  const payload = choice?.message;
  const content: ContentPart[] = [];

  if (payload?.content) {
    content.push({ type: "text", text: payload.content });
  }

  for (const call of payload?.tool_calls ?? []) {
    content.push({
      type: "tool_call",
      id: call.id,
      name: call.function?.name ?? "unknown",
      arguments: parseToolArguments(call.function?.arguments),
    });
  }

  const message: InternalMessage = {
    role: "assistant",
    content: content.length > 0 ? content : [{ type: "text", text: "" }],
  };

  return { message, stopReason: mapFinishReason(choice?.finish_reason) };
}

function mapFinishReason(reason: string | null | undefined): StopReason {
  if (reason === "tool_calls") return "tool_use";
  if (reason === "length") return "max_tokens";
  if (reason === "stop") return "end_turn";
  return "other";
}

export const openaiCompatibleAdapter: ProviderAdapter = {
  async complete(input) {
    const body = toOpenAIRequest(input);
    const url = joinEndpoint(input.baseUrl || DEFAULT_BASE, "/chat/completions");
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (input.apiKey) {
      headers.authorization = `Bearer ${input.apiKey}`;
    }

    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers,
      body: JSON.stringify({
        model: input.modelId,
        max_tokens: input.maxTokens ?? 4096,
        messages: body.messages,
        ...(body.tools ? { tools: body.tools, tool_choice: "auto" } : {}),
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(
        sanitizeProviderError(
          `OpenAI-compatible request failed (${response.status}): ${raw.slice(0, 500)}`,
          input.apiKey,
        ),
      );
    }

    return fromOpenAIResponse(JSON.parse(raw) as Parameters<typeof fromOpenAIResponse>[0]);
  },
};
