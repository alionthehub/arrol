import "server-only";
import { openSecret, sealSecret, type KeyRing } from "@/lib/security/cipher";
import { requiredEnv } from "@/lib/security/env";

export function keyRingFromEnv(env: NodeJS.ProcessEnv = process.env): KeyRing {
  const current = {
    id: env.ARROL_ENCRYPTION_KEY_VERSION?.trim() || "1",
    key: requiredEnv("ARROL_ENCRYPTION_KEY"),
  };
  const previousKey = env.ARROL_ENCRYPTION_KEY_PREVIOUS?.trim();
  if (!previousKey) return { current };
  return {
    current,
    previous: {
      id: env.ARROL_ENCRYPTION_KEY_PREVIOUS_VERSION?.trim() || "0",
      key: previousKey,
    },
  };
}

export function encryptString(plain: string) {
  return sealSecret(plain, keyRingFromEnv());
}

export function decryptString(stored: string) {
  return openSecret(stored, keyRingFromEnv());
}
