import { randomInt } from "crypto";
import { sha256Hex } from "@/lib/security/bytes";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const RECOVERY_CODE_COUNT = 10;

export function generateRecoveryCode() {
  const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8).join("")}`;
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  return Array.from({ length: count }, () => generateRecoveryCode());
}

export function normalizeRecoveryCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(code: string) {
  return sha256Hex(normalizeRecoveryCode(code));
}
