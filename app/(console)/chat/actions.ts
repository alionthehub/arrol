"use server";

import { runAgent, type ConversationTurn, type ToolInvocation } from "@/lib/agent/loop";
import { getModelById } from "@/lib/models";
import { requireSessionAction } from "@/lib/session";

export type ChatActionResult =
  | {
      ok: true;
      text: string;
      toolCalls: ToolInvocation[];
      iterations: number;
      hitIterationCap: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export type ChatHistoryItem = {
  role: "user" | "assistant";
  text: string;
};

export async function sendChatMessage(input: {
  modelId: number;
  message: string;
  history: ChatHistoryItem[];
}): Promise<ChatActionResult> {
  await requireSessionAction();

  const message = input.message.trim();
  if (!message) {
    return { ok: false, error: "Enter a message." };
  }
  if (!Number.isInteger(input.modelId) || input.modelId <= 0) {
    return { ok: false, error: "Select a model." };
  }

  const model = await getModelById(input.modelId);
  if (!model) {
    return { ok: false, error: "Model not found." };
  }

  const history: ConversationTurn[] = input.history
    .filter(
      (turn) =>
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.text === "string" &&
        turn.text.trim().length > 0,
    )
    .map((turn) => ({ role: turn.role, text: turn.text.trim() }));

  try {
    const result = await runAgent({
      model,
      history,
      userMessage: message,
    });
    return {
      ok: true,
      text: result.text,
      toolCalls: result.toolCalls,
      iterations: result.iterations,
      hitIterationCap: result.hitIterationCap,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The agent failed.",
    };
  }
}
