import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { passkeyVerify, type AuthIntent } from "@/lib/security/auth-flow";
import { jsonError, readJson } from "@/lib/security/request";

export const runtime = "nodejs";

function intentOf(value: unknown): AuthIntent | null {
  if (
    value === "sign-in" ||
    value === "step-up" ||
    value === "enroll" ||
    value === "reenroll"
  ) {
    return value;
  }
  return null;
}

export async function POST(request: Request) {
  const body = await readJson(request);
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (record.intent === "setup") return new Response(null, { status: 404 });
  const intent = intentOf(record.intent);
  const response = record.response;
  if (!intent || !response || typeof response !== "object") {
    return jsonError(400, "BAD REQUEST");
  }
  return passkeyVerify(
    request,
    intent,
    record.setupToken,
    response as RegistrationResponseJSON | AuthenticationResponseJSON,
  );
}
