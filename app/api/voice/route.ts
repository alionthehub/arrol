import { runAgent } from "@/lib/agent/loop";
import { isValidShortcutRequest } from "@/lib/auth";
import { listEnabledModels } from "@/lib/models";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isValidShortcutRequest(request)) {
    return Response.json({ error: "ACCESS DENIED" }, { status: 401 });
  }

  let text = "";
  try {
    const body = (await request.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }

  if (!text) {
    return Response.json({ error: "Missing text." }, { status: 400 });
  }
  if (text.length > 8000) {
    return Response.json({ error: "Text too long." }, { status: 400 });
  }

  try {
    const model = await resolveChatModel();
    if (!model) {
      return Response.json({ error: "No model assigned." }, { status: 503 });
    }
    const result = await runAgent({
      model,
      history: [],
      userMessage: text,
    });
    return Response.json({ reply: result.text || "ACK" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Agent failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}

async function resolveChatModel() {
  const [models, settings] = await Promise.all([
    listEnabledModels(),
    getSettings(),
  ]);
  const chatId = settings.task_models.chat;
  if (chatId) {
    const match = models.find((model) => model.id === chatId);
    if (match) return match;
  }
  return models[0] ?? null;
}
