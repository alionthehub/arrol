import { passkeyOptions, type AuthIntent } from "@/lib/security/auth-flow";
import { jsonError, readJson } from "@/lib/security/request";

export const runtime = "nodejs";

function intentOf(value: unknown): AuthIntent | null {
  if (value === "setup" || value === "sign-in" || value === "step-up" || value === "enroll") {
    return value;
  }
  return null;
}

export async function POST(request: Request) {
  const body = await readJson(request);
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const intent = intentOf(record.intent);
  if (!intent) return jsonError(400, "BAD REQUEST");
  return passkeyOptions(request, intent, record.setupToken);
}
