import { totpVerify } from "@/lib/security/auth-flow";
import { jsonError, readJson } from "@/lib/security/request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await readJson(request);
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (record.intent === "setup" || record.intent === "reveal") {
    return new Response(null, { status: 404 });
  }
  const intent = record.intent;
  if (intent !== "sign-in" && intent !== "step-up") {
    return jsonError(400, "BAD REQUEST");
  }
  return totpVerify(request, intent, record.setupToken, record.code);
}
