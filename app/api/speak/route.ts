import { isAuthenticated } from "@/lib/session";
import { streamElevenLabsSpeech } from "@/lib/voice";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "ACCESS DENIED" }, { status: 401 });
  }

  let text = "";
  try {
    const body = (await request.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text : "";
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }

  if (!text.trim()) {
    return Response.json({ error: "Nothing to speak." }, { status: 400 });
  }
  if (text.length > 8000) {
    return Response.json({ error: "Reply too long to speak." }, { status: 400 });
  }

  try {
    return await streamElevenLabsSpeech(text);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Speech failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
