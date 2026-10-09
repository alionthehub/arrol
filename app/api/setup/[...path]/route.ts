import {
  isSetupComplete,
  passkeyOptions,
  passkeyVerify,
  totpVerify,
} from "@/lib/security/auth-flow";
import { setupRequest } from "@/lib/security/setup-gate";
import { jsonError, readJson } from "@/lib/security/request";

export const runtime = "nodejs";

async function unavailable() {
  return setupRequest(await isSetupComplete());
}

export async function GET() {
  const closed = await unavailable();
  if (closed) return closed;
  return new Response(null, { status: 404 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const closed = await unavailable();
  if (closed) return closed;

  const { path } = await context.params;
  const key = path.join("/");
  const body = await readJson(request);
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  if (key === "passkey/options") {
    return passkeyOptions(request, "setup", record.setupToken);
  }
  if (key === "passkey/verify") {
    return passkeyVerify(
      request,
      "setup",
      record.setupToken,
      record.response as never,
    );
  }
  if (key === "totp") {
    const intent = record.intent === "reveal" ? "reveal" : "setup";
    return totpVerify(request, intent, record.setupToken, record.code);
  }
  return jsonError(404, "NOT FOUND");
}
