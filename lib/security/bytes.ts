import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export function randomId(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacBase64Url(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
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

export function hashIp(ip: string) {
  return sha256Hex(`arrol.ip.v1:${ip}`).slice(0, 16);
}
