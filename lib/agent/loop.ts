import { getAdapter } from "@/lib/agent";
import { AGENT_TOOLS, executeTool } from "@/lib/agent/tools";
import {
  textFromMessage,
  toolCallsFromMessage,
  type InternalMessage,
} from "@/lib/agent/types";
import { KEY_ENV_VAR_PATTERN, type Model } from "@/lib/model-types";

export const MAX_AGENT_ITERATIONS = 10;

const SYSTEM_PROMPT =
  "You are a helpful assistant. Use tools when they help you answer. When you have a final answer, respond to the user without calling tools.";

export type ConversationTurn = {
  role: "user" | "assistant";
  text: string;
};

export type ToolInvocation = {
  name: string;
  arguments: Record<string, unknown>;
  result: string;
  isError: boolean;
};

export type AgentRunResult = {
  text: string;
  toolCalls: ToolInvocation[];
  iterations: number;
  hitIterationCap: boolean;
};

function readApiKey(model: Model): string | undefined {
  if (!KEY_ENV_VAR_PATTERN.test(model.key_env_var)) {
    throw new Error("Model key_env_var is not a valid environment variable name.");
  }
  const value = process.env[model.key_env_var];
  return value && value.length > 0 ? value : undefined;
}

function historyToMessages(history: ConversationTurn[]): InternalMessage[] {
  return [
    {
      role: "system",
      content: [{ type: "text", text: SYSTEM_PROMPT }],
    },
    ...history.map((turn) => ({
      role: turn.role,
      content: [{ type: "text" as const, text: turn.text }],
    })),
  ];
}

export async function runAgent(options: {
  model: Model;
  history: ConversationTurn[];
  userMessage: string;
}): Promise<AgentRunResult> {
  if (!options.model.enabled) {
    throw new Error("That model is disabled.");
  }

  const adapter = getAdapter(options.model.provider_type);
  const apiKey = readApiKey(options.model);
  const messages: InternalMessage[] = [
    ...historyToMessages(options.history),
    { role: "user", content: [{ type: "text", text: options.userMessage }] },
  ];

  const toolCalls: ToolInvocation[] = [];
  let lastText = "";

  for (let iteration = 1; iteration <= MAX_AGENT_ITERATIONS; iteration += 1) {
    const turn = await adapter.complete({
      modelId: options.model.model_id,
      baseUrl: options.model.base_url,
      apiKey,
      messages,
      tools: AGENT_TOOLS,
    });

    messages.push(turn.message);
    lastText = textFromMessage(turn.message);
    const calls = toolCallsFromMessage(turn.message);

    if (calls.length === 0) {
      return {
        text: lastText,
        toolCalls,
        iterations: iteration,
        hitIterationCap: false,
      };
    }

    const resultParts = [];
    for (const call of calls) {
      const executed = await executeTool(call.name, call.arguments);
      toolCalls.push({
        name: call.name,
        arguments: call.arguments,
        result: executed.content,
        isError: executed.isError,
      });
      resultParts.push({
        type: "tool_result" as const,
        toolCallId: call.id,
        name: call.name,
        content: executed.content,
        isError: executed.isError,
      });
    }
    messages.push({ role: "tool", content: resultParts });

    if (iteration === MAX_AGENT_ITERATIONS) {
      return {
        text:
          lastText ||
          "Stopped after 10 tool iterations without a final answer.",
        toolCalls,
        iterations: iteration,
        hitIterationCap: true,
      };
    }
  }

  return {
    text: lastText,
    toolCalls,
    iterations: MAX_AGENT_ITERATIONS,
    hitIterationCap: true,
  };
}
