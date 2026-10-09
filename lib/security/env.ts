import "server-only";

export function requiredEnv(name: string) {
  const value = process.env[name]?.trim() ?? "";
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function webauthnConfig() {
  const rpID = requiredEnv("WEBAUTHN_RP_ID");
  const origin = requiredEnv("WEBAUTHN_ORIGIN");
  return { rpID, origin, rpName: "Arrol" };
}

export function ownerEmail() {
  return requiredEnv("ARROL_OWNER_EMAIL").toLowerCase();
}

export function setupToken() {
  const token = requiredEnv("ARROL_SETUP_TOKEN");
  if (token.length < 32) {
    throw new Error("ARROL_SETUP_TOKEN is too short");
  }
  return token;
}

export function sessionSecret() {
  const secret = requiredEnv("ARROL_SESSION_SECRET");
  if (secret.length < 32) {
    throw new Error("ARROL_SESSION_SECRET is too short");
  }
  return secret;
}
