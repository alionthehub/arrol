import { randomId, safeEqual, sha256Hex } from "@/lib/security/bytes";
import { isApiScope, type ApiScope } from "@/lib/security/constants";

export function generateApiToken() {
  return `arrol_${randomId(32)}`;
}

export function hashApiToken(token: string) {
  return sha256Hex(token);
}

export function readBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match?.[1] ?? "";
}

export type ScopeDecision = "anonymous" | "forbidden" | "ok";

export function scopeDecision(
  scopes: readonly string[] | null,
  required: string,
): ScopeDecision {
  if (!scopes) return "anonymous";
  if (scopes.includes(required)) return "ok";
  return "forbidden";
}

export function rejectUnlessScope(
  scopes: readonly string[] | null,
  required: string,
): Response | null {
  const decision = scopeDecision(scopes, required);
  if (decision === "ok") return null;
  if (decision === "anonymous") {
    return Response.json(
      { error: "ACCESS DENIED" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    { error: "FORBIDDEN" },
    { status: 403, headers: { "cache-control": "no-store" } },
  );
}

export function parseScopes(values: readonly string[]): ApiScope[] | null {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (unique.length === 0) return null;
  if (!unique.every(isApiScope)) return null;
  return unique;
}

export function tokenNameOk(name: string) {
  return /^[a-z0-9][a-z0-9-]{1,40}$/.test(name);
}

export function bearerMatches(presented: string, expectedHash: string) {
  if (!presented || !expectedHash) return false;
  return safeEqual(hashApiToken(presented), expectedHash);
}
