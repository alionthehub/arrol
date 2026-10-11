import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { randomId, sha256Hex } from "@/lib/security/bytes";
import {
  CRT_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  STEP_UP_MAX_AGE_MS,
} from "@/lib/security/constants";
import {
  issueSessionCookieValue,
  readSessionCookie,
  sessionCookieOptions,
} from "@/lib/security/cookie";
import { sessionSecret } from "@/lib/security/env";

export { CRT_COOKIE, SESSION_COOKIE, sessionCookieOptions };

export type ActiveSession = {
  id: string;
  userId: string;
  lastReauthAt: Date;
  method: string;
};

async function cookieStore() {
  return cookies();
}

export async function getSessionToken() {
  const store = await cookieStore();
  return store.get(SESSION_COOKIE)?.value;
}

export async function readActiveSession(): Promise<ActiveSession | null> {
  let secret = "";
  try {
    secret = sessionSecret();
  } catch {
    return null;
  }
  const store = await cookieStore();
  const parsed = readSessionCookie(store.get(SESSION_COOKIE)?.value, secret);
  if (!parsed) return null;
  try {
    const row = await prisma.session.findUnique({ where: { id: parsed.idHash } });
    if (!row || row.revokedAt) return null;
    if (row.expiresAt.getTime() <= Date.now()) return null;
    return {
      id: row.id,
      userId: row.userId,
      lastReauthAt: row.lastReauthAt,
      method: row.method,
    };
  } catch {
    return null;
  }
}

export async function isAuthenticated() {
  return (await readActiveSession()) !== null;
}

export async function requireSession() {
  const session = await readActiveSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireSessionAction() {
  const session = await readActiveSession();
  if (!session) {
    throw new Error("ACCESS DENIED");
  }
  return session;
}

export function isRecentAuth(session: ActiveSession, now = Date.now()) {
  return now - session.lastReauthAt.getTime() <= STEP_UP_MAX_AGE_MS;
}

export async function openSession(userId: string, method: "passkey" | "totp") {
  const sessionId = randomId(32);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await prisma.session.create({
    data: {
      id: sha256Hex(sessionId),
      userId,
      expiresAt,
      lastReauthAt: new Date(),
      method,
    },
  });
  const store = await cookieStore();
  store.set(
    SESSION_COOKIE,
    issueSessionCookieValue(
      sessionId,
      Math.floor(expiresAt.getTime() / 1000),
      sessionSecret(),
    ),
    sessionCookieOptions(),
  );
}

export async function touchReauth(sessionIdHash: string) {
  await prisma.session.update({
    where: { id: sessionIdHash },
    data: { lastReauthAt: new Date() },
  });
}

export async function clearSessionCookie() {
  const store = await cookieStore();
  let secret = "";
  try {
    secret = sessionSecret();
  } catch {
    secret = "";
  }
  const parsed = secret
    ? readSessionCookie(store.get(SESSION_COOKIE)?.value, secret)
    : null;
  if (parsed) {
    await prisma.session
      .update({
        where: { id: parsed.idHash },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }
  store.delete(SESSION_COOKIE);
}

export async function crtEffectsFromCookie(fallback = true) {
  const store = await cookieStore();
  const value = store.get(CRT_COOKIE)?.value;
  if (value === "0") return false;
  if (value === "1") return true;
  return fallback;
}

export async function writeCrtCookie(enabled: boolean) {
  const store = await cookieStore();
  store.set(CRT_COOKIE, enabled ? "1" : "0", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}
