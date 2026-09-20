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
  type ToolCallPart,
  type ToolDefinition,
} from "@/lib/agent/types";

const DEFAULT_BASE = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";

type AnthropicContent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContent[];
};

export function toAnthropicRequest(input: ProviderCompleteInput): {
  system?: string;
  messages: AnthropicMessage[];
  tools?: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }>;
} {
  const systemParts: string[] = [];
  const messages: AnthropicMessage[] = [];

  for (const message of input.messages) {
    if (message.role === "system") {
      const text = message.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      if (text) systemParts.push(text);
      continue;
    }

    if (message.role === "tool") {
      const blocks: AnthropicContent[] = message.content
        .filter((part) => part.type === "tool_result")
        .map((part) => ({
          type: "tool_result" as const,
          tool_use_id: part.toolCallId,
          content: part.content,
          is_error: part.isError,
        }));
      if (blocks.length === 0) continue;
      const last = messages[messages.length - 1];
      if (last?.role === "user" && Array.isArray(last.content)) {
        last.content.push(...blocks);
      } else {
        messages.push({ role: "user", content: blocks });
      }
      continue;
    }

    if (message.role === "user") {
      const text = message.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      messages.push({ role: "user", content: text });
      continue;
    }

    const blocks: AnthropicContent[] = [];
    for (const part of message.content) {
      if (part.type === "text" && part.text) {
        blocks.push({ type: "text", text: part.text });
      }
      if (part.type === "tool_call") {
        blocks.push({
          type: "tool_use",
          id: part.id,
          name: part.name,
          input: part.arguments,
        });
      }
    }
    messages.push({
      role: "assistant",
      content: blocks.length > 0 ? blocks : [{ type: "text", text: "" }],
    });
  }

  const tools =
    input.tools.length > 0
      ? input.tools.map((tool: ToolDefinition) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters,
        }))
      : undefined;

  return {
    system: systemParts.join("\n") || undefined,
    messages,
    tools,
  };
}

export function fromAnthropicResponse(data: {
  content?: AnthropicContent[];
  stop_reason?: string | null;
}): AssistantTurn {
  const content: ContentPart[] = [];
  for (const block of data.content ?? []) {
    if (block.type === "text" && block.text) {
      content.push({ type: "text", text: block.text });
    }
    if (block.type === "tool_use") {
      const call: ToolCallPart = {
        type: "tool_call",
        id: block.id,
        name: block.name,
        arguments: parseToolArguments(block.input),
      };
      content.push(call);
    }
  }

  const message: InternalMessage = {
    role: "assistant",
    content:
      content.length > 0 ? content : [{ type: "text", text: "" }],
  };

  return { message, stopReason: mapStopReason(data.stop_reason) };
}

function mapStopReason(reason: string | null | undefined): StopReason {
  if (reason === "tool_use") return "tool_use";
  if (reason === "max_tokens") return "max_tokens";
  if (reason === "end_turn" || reason === "stop_sequence") return "end_turn";
  return "other";
}

export const anthropicAdapter: ProviderAdapter = {
  async complete(input) {
    if (!input.apiKey) {
      throw new Error("Anthropic API key is missing. Set the env var named in key_env_var.");
    }

    const body = toAnthropicRequest(input);
    const url = joinEndpoint(input.baseUrl || DEFAULT_BASE, "/v1/messages");
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: input.modelId,
        max_tokens: input.maxTokens ?? 4096,
        ...body,
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(
        sanitizeProviderError(
          `Anthropic request failed (${response.status}): ${raw.slice(0, 500)}`,
          input.apiKey,
        ),
      );
    }

    const data = JSON.parse(raw) as {
      content?: AnthropicContent[];
      stop_reason?: string | null;
    };
    return fromAnthropicResponse(data);
  },
};
