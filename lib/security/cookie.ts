import { hmacBase64Url, safeEqual, sha256Hex } from "@/lib/security/bytes";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/security/constants";

export type SessionCookie = {
  sessionId: string;
  expiresAtSec: number;
  idHash: string;
};

export function sessionCookieOptions(env: { NODE_ENV?: string } = process.env) {
  return {
    httpOnly: true as const,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function issueSessionCookieValue(
  sessionId: string,
  expiresAtSec: number,
  secret: string,
) {
  const payload = `${sessionId}.${expiresAtSec}`;
  return `${payload}.${hmacBase64Url(secret, payload)}`;
}

export function readSessionCookie(
  value: string | undefined | null,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
): SessionCookie | null {
  if (!value || !secret) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [sessionId, expRaw, signature] = parts;
  if (!sessionId || !/^[A-Za-z0-9_-]{20,}$/.test(sessionId)) return null;
  if (!/^\d+$/.test(expRaw ?? "")) return null;
  const expiresAtSec = Number(expRaw);
  const expected = hmacBase64Url(secret, `${sessionId}.${expRaw}`);
  if (!safeEqual(signature ?? "", expected)) return null;
  if (expiresAtSec <= nowSec) return null;
  if (expiresAtSec - nowSec > SESSION_MAX_AGE_SECONDS) return null;
  return { sessionId, expiresAtSec, idHash: sha256Hex(sessionId) };
}
