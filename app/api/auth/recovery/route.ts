import { redeemRecoveryCode } from "@/lib/security/auth-flow";
import { readJson } from "@/lib/security/request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await readJson(request);
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  return redeemRecoveryCode(request, record.code);
}
