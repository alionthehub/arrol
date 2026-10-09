import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export type KeyVersion = {
  id: string;
  key: string;
};

export type KeyRing = {
  current: KeyVersion;
  previous?: KeyVersion;
};

function keyBytes(raw: string) {
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("Encryption key must be 32 bytes, base64-encoded");
  }
  return key;
}

function sealWith(plain: string, version: KeyVersion) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(version.key), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, ciphertext]).toString("base64");
  return `v${version.id}:${payload}`;
}

function openWith(payload: string, version: KeyVersion) {
  const buf = Buffer.from(payload, "base64");
  if (buf.length < 29) {
    throw new Error("Ciphertext is truncated");
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(version.key), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function sealSecret(plain: string, ring: KeyRing) {
  if (!/^[0-9]+$/.test(ring.current.id)) {
    throw new Error("Encryption key version must be numeric");
  }
  return sealWith(plain, ring.current);
}

export function openSecret(stored: string, ring: KeyRing) {
  const match = /^v([0-9]+):([\s\S]*)$/.exec(stored);
  if (!match) {
    return openWith(stored, ring.current);
  }
  const id = match[1] ?? "";
  const payload = match[2] ?? "";
  if (id === ring.current.id) return openWith(payload, ring.current);
  if (ring.previous && id === ring.previous.id) return openWith(payload, ring.previous);
  throw new Error("No encryption key for this version");
}
