export const SESSION_COOKIE = "arrol_session";
export const CRT_COOKIE = "arrol_crt";
export const REENROLL_COOKIE = "arrol_reenroll";

/** Absolute session lifetime. Re-auth is required again for sensitive actions. */
export const SESSION_MAX_AGE_SECONDS = 2 * 60 * 60;

/** Window after sign-in or step-up during which sensitive actions are allowed. */
export const STEP_UP_MAX_AGE_MS = 5 * 60 * 1000;

export const LOGIN_RATE_LIMIT = 5;
export const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
export const REENROLL_MAX_AGE_SECONDS = 10 * 60;

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export const AUDIT_SOURCES = ["web", "voice", "api"] as const;
export type AuditSource = (typeof AUDIT_SOURCES)[number];

export const API_SCOPES = [
  "voice:invoke",
  "reminders:read",
  "reminders:write",
  "models:read",
  "models:write",
  "settings:write",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value);
}
