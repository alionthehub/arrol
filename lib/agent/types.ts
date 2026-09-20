export type TextPart = {
  type: "text";
  text: string;
};

export type ToolCallPart = {
  type: "tool_call";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ToolResultPart = {
  type: "tool_result";
  toolCallId: string;
  name: string;
  content: string;
  isError?: boolean;
};

export type ContentPart = TextPart | ToolCallPart | ToolResultPart;

export type InternalMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: ContentPart[];
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "other";

export type AssistantTurn = {
  message: InternalMessage;
  stopReason: StopReason;
};

export type ProviderCompleteInput = {
  modelId: string;
  baseUrl: string | null;
  apiKey?: string;
  messages: InternalMessage[];
  tools: ToolDefinition[];
  maxTokens?: number;
};

export type ProviderAdapter = {
  complete(input: ProviderCompleteInput): Promise<AssistantTurn>;
};

export function textFromMessage(message: InternalMessage): string {
  return message.content
    .filter((part): part is TextPart => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function toolCallsFromMessage(message: InternalMessage): ToolCallPart[] {
  return message.content.filter(
    (part): part is ToolCallPart => part.type === "tool_call",
  );
}

export function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return { raw };
    }
  }
  return {};
}

export function joinEndpoint(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (base.endsWith(suffix)) return base;
  return `${base}${suffix}`;
}

export function sanitizeProviderError(message: string, apiKey?: string): string {
  let next = message;
  if (apiKey) {
    next = next.split(apiKey).join("[redacted]");
  }
  return next;
}
