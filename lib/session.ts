import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  CRT_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  expectedSessionToken,
  isValidSession,
} from "@/lib/auth";

export async function getSessionToken() {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

export async function isAuthenticated() {
  return isValidSession(await getSessionToken());
}

export async function requireSession() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }
}

export async function requireSessionAction() {
  if (!(await isAuthenticated())) {
    throw new Error("ACCESS DENIED");
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export async function writeSessionCookie() {
  const token = expectedSessionToken();
  if (!token) {
    throw new Error("ARROL_PASSWORD is not set.");
  }
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function crtEffectsFromCookie(fallback = true) {
  const store = await cookies();
  const value = store.get(CRT_COOKIE)?.value;
  if (value === "0") return false;
  if (value === "1") return true;
  return fallback;
}

export async function writeCrtCookie(enabled: boolean) {
  const store = await cookies();
  store.set(CRT_COOKIE, enabled ? "1" : "0", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}
