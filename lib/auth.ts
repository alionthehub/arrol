import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "arrol_session";
export const CRT_COOKIE = "arrol_crt";
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

const SESSION_PAYLOAD = "arrol.session.v1";

export function getGatePassword() {
  return process.env.ARROL_PASSWORD ?? "";
}

export function isPasswordConfigured() {
  return getGatePassword().length > 0;
}

function hmacHex(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function sessionTokenForPassword(password: string) {
  return hmacHex(password, SESSION_PAYLOAD);
}

export function expectedSessionToken() {
  const password = getGatePassword();
  if (!password) return null;
  return sessionTokenForPassword(password);
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function isValidSession(token: string | undefined | null) {
  const expected = expectedSessionToken();
  if (!expected || !token) return false;
  return safeEqual(token, expected);
}

export function passwordMatches(input: string) {
  const password = getGatePassword();
  if (!password) return false;
  return safeEqual(input, password);
}
