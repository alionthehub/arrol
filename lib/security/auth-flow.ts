import "server-only";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/security/audit-log";
import { safeEqual, sha256Hex } from "@/lib/security/bytes";
import { decryptString, encryptString } from "@/lib/security/crypto";
import {
  CHALLENGE_TTL_MS,
  LOGIN_RATE_LIMIT,
  LOGIN_RATE_WINDOW_MS,
} from "@/lib/security/constants";
import {
  ownerEmail,
  requiredEnv,
  setupToken,
  webauthnConfig,
} from "@/lib/security/env";
import { advanceRateLimit, rateLimitBlocked } from "@/lib/security/rate-limit";
import {
  clientIpHash,
  jsonError,
  originAllowed,
} from "@/lib/security/request";
import {
  isRecentAuth,
  openSession,
  readActiveSession,
  touchReauth,
} from "@/lib/session";
import { createTotpSecret, totpMatches, totpUri } from "@/lib/security/totp";

export type Enrollment = "needs-passkey" | "needs-totp" | "ready";
export type AuthIntent = "setup" | "sign-in" | "step-up" | "enroll";

function challengeFrom(clientDataJSON: string) {
  try {
    const json = JSON.parse(
      Buffer.from(clientDataJSON, "base64url").toString("utf8"),
    ) as { challenge?: unknown };
    return typeof json.challenge === "string" ? json.challenge : "";
  } catch {
    return "";
  }
}

async function enrollment(): Promise<Enrollment> {
  const credentials = await prisma.webAuthnCredential.count();
  const totp = await prisma.totpSecret.findFirst();
  if (credentials === 0) return "needs-passkey";
  if (!totp?.verifiedAt) return "needs-totp";
  return "ready";
}

export async function enrollmentState(): Promise<Enrollment> {
  return enrollment();
}

async function ensureOwner() {
  const email = ownerEmail();
  const users = await prisma.user.findMany({ take: 2 });
  if (users.length > 1) {
    throw new Error("Multiple owner records");
  }
  if (users.length === 0) {
    return prisma.user.create({ data: { email } });
  }
  if (users[0]?.email !== email) {
    throw new Error("Owner record does not match ARROL_OWNER_EMAIL");
  }
  return users[0];
}

function setupOk(presented: unknown) {
  if (typeof presented !== "string" || !presented) return false;
  try {
    return safeEqual(presented, setupToken());
  } catch {
    return false;
  }
}

async function attemptState(purpose: string, request: Request) {
  const id = sha256Hex(`${purpose}:${clientIpHash(request)}`);
  const existing = await prisma.loginAttempt.findUnique({ where: { id } });
  const now = Date.now();
  const current = existing
    ? { windowStartMs: existing.windowStart.getTime(), count: existing.count }
    : null;
  return { id, now, current };
}

async function blocked(purpose: string, request: Request) {
  const { current, now } = await attemptState(purpose, request);
  return rateLimitBlocked(current, now, {
    limit: LOGIN_RATE_LIMIT,
    windowMs: LOGIN_RATE_WINDOW_MS,
  });
}

async function recordFailure(purpose: string, request: Request) {
  const { id, current, now } = await attemptState(purpose, request);
  const result = advanceRateLimit(current, now, {
    limit: LOGIN_RATE_LIMIT,
    windowMs: LOGIN_RATE_WINDOW_MS,
  });
  await prisma.loginAttempt.upsert({
    where: { id },
    create: {
      id,
      windowStart: new Date(result.next.windowStartMs),
      count: result.next.count,
    },
    update: {
      windowStart: new Date(result.next.windowStartMs),
      count: result.next.count,
    },
  });
}

async function fail(
  request: Request,
  purpose: string,
  reason: string,
  status = 401,
) {
  await recordFailure(purpose, request);
  await writeAudit({
    action: "auth.sign_in",
    outcome: "failure",
    source: "web",
    metadata: { reason, ipHash: clientIpHash(request) },
  });
  return jsonError(status, status === 429 ? "TOO MANY ATTEMPTS" : "ACCESS DENIED");
}

async function begin(request: Request, purpose: string) {
  let origin = "";
  try {
    origin = webauthnConfig().origin;
  } catch (error) {
    console.error(
      "[arrol-auth]",
      error instanceof Error ? error.message : "config",
    );
    return jsonError(500, "AUTH UNAVAILABLE");
  }
  if (!originAllowed(request, origin)) {
    return fail(request, purpose, "origin", 403);
  }
  if (await blocked(purpose, request)) {
    await writeAudit({
      action: "auth.sign_in",
      outcome: "failure",
      source: "web",
      metadata: { reason: "rate-limited", ipHash: clientIpHash(request) },
    });
    return jsonError(429, "TOO MANY ATTEMPTS");
  }
  return null;
}

async function saveChallenge(challenge: string, purpose: string) {
  await prisma.authChallenge.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  await prisma.authChallenge.create({
    data: {
      challenge,
      purpose,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });
}

async function takeChallenge(challenge: string, purpose: string) {
  if (!challenge) return false;
  const deleted = await prisma.authChallenge.deleteMany({
    where: { challenge, purpose, expiresAt: { gt: new Date() } },
  });
  return deleted.count === 1;
}

export async function passkeyOptions(
  request: Request,
  intent: AuthIntent,
  setupTokenValue: unknown,
) {
  const denied = await begin(request, `passkey:${intent}`);
  if (denied) return denied;

  try {
    const { rpID, rpName } = webauthnConfig();
    const state = await enrollment();

    if (intent === "enroll") {
      const session = await readActiveSession();
      if (!session) return jsonError(401, "ACCESS DENIED");
      if (!isRecentAuth(session)) return jsonError(401, "REAUTH REQUIRED");
      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (!user) return jsonError(401, "ACCESS DENIED");
      const existing = await prisma.webAuthnCredential.findMany({
        where: { userId: user.id },
      });
      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userName: user.email,
        userID: new TextEncoder().encode(user.id),
        attestationType: "none",
        excludeCredentials: existing.map((credential) => ({
          id: credential.credentialId,
          transports: credential.transports,
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "required",
        },
      });
      await saveChallenge(options.challenge, "enroll");
      return Response.json(options, { headers: { "cache-control": "no-store" } });
    }

    if (intent === "step-up") {
      const session = await readActiveSession();
      if (!session) return jsonError(401, "ACCESS DENIED");
      const credentials = await prisma.webAuthnCredential.findMany({
        where: { userId: session.userId },
      });
      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: "required",
        allowCredentials: credentials.map((credential) => ({
          id: credential.credentialId,
          transports: credential.transports,
        })),
      });
      await saveChallenge(options.challenge, "step-up");
      return Response.json(options, { headers: { "cache-control": "no-store" } });
    }

    if (intent === "setup") {
      if (!setupOk(setupTokenValue)) {
        return fail(request, `passkey:${intent}`, "setup-token");
      }
      if (state !== "needs-passkey") {
        return jsonError(409, state === "ready" ? "SETUP CLOSED" : "FINISH SETUP");
      }
      const user = await ensureOwner();
      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userName: user.email,
        userID: new TextEncoder().encode(user.id),
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "required",
        },
      });
      await saveChallenge(options.challenge, "register");
      return Response.json(options, { headers: { "cache-control": "no-store" } });
    }

    if (state === "needs-passkey") return jsonError(409, "NOT ENROLLED");
    if (state === "needs-totp") return jsonError(409, "FINISH SETUP");
    const credentials = await prisma.webAuthnCredential.findMany();
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: credentials.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports,
      })),
    });
    await saveChallenge(options.challenge, "authenticate");
    return Response.json(options, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error(
      "[arrol-auth]",
      error instanceof Error ? error.message : "passkey options",
    );
    return jsonError(500, "AUTH UNAVAILABLE");
  }
}

export async function passkeyVerify(
  request: Request,
  intent: AuthIntent,
  setupTokenValue: unknown,
  response: RegistrationResponseJSON | AuthenticationResponseJSON,
) {
  const denied = await begin(request, `passkey-verify:${intent}`);
  if (denied) return denied;
  if (!response || typeof response !== "object" || !("response" in response)) {
    return fail(request, `passkey-verify:${intent}`, "payload");
  }

  try {
    const { origin, rpID } = webauthnConfig();
    const clientData =
      "attestationObject" in response.response
        ? response.response.clientDataJSON
        : response.response.clientDataJSON;
    const challenge = challengeFrom(clientData);

    if (intent === "enroll") {
      const session = await readActiveSession();
      if (!session || !isRecentAuth(session)) return jsonError(401, "REAUTH REQUIRED");
      if (!(await takeChallenge(challenge, "enroll"))) {
        return fail(request, `passkey-verify:${intent}`, "challenge");
      }
      const verified = await verifyRegistrationResponse({
        response: response as RegistrationResponseJSON,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
      if (!verified.verified) {
        return fail(request, `passkey-verify:${intent}`, "passkey");
      }
      const credential = verified.registrationInfo.credential;
      await prisma.webAuthnCredential.create({
        data: {
          credentialId: credential.id,
          userId: session.userId,
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter),
          transports: credential.transports ?? [],
        },
      });
      await writeAudit({
        action: "webauthn.register",
        outcome: "success",
        source: "web",
        actor: session.userId,
        metadata: { ipHash: clientIpHash(request) },
      });
      return Response.json(
        { status: "ok" },
        { headers: { "cache-control": "no-store" } },
      );
    }

    if (intent === "setup") {
      if (!setupOk(setupTokenValue)) {
        return fail(request, `passkey-verify:${intent}`, "setup-token");
      }
      if ((await enrollment()) !== "needs-passkey") {
        return jsonError(409, "SETUP CLOSED");
      }
      if (!(await takeChallenge(challenge, "register"))) {
        return fail(request, `passkey-verify:${intent}`, "challenge");
      }
      const verified = await verifyRegistrationResponse({
        response: response as RegistrationResponseJSON,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
      if (!verified.verified) {
        return fail(request, `passkey-verify:${intent}`, "passkey");
      }
      const user = await ensureOwner();
      const credential = verified.registrationInfo.credential;
      await prisma.webAuthnCredential.create({
        data: {
          credentialId: credential.id,
          userId: user.id,
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter),
          transports: credential.transports ?? [],
        },
      });
      const totp = createTotpSecret(user.email);
      await prisma.totpSecret.create({
        data: {
          userId: user.id,
          ciphertext: encryptString(totp.secret, requiredEnv("ARROL_ENCRYPTION_KEY")),
        },
      });
      await writeAudit({
        action: "webauthn.register",
        outcome: "success",
        source: "web",
        actor: user.id,
        metadata: { ipHash: clientIpHash(request) },
      });
      return Response.json(
        { status: "totp", secret: totp.secret, uri: totp.uri },
        { headers: { "cache-control": "no-store" } },
      );
    }

    const purpose = intent === "step-up" ? "step-up" : "authenticate";
    if (!(await takeChallenge(challenge, purpose))) {
      return fail(request, `passkey-verify:${intent}`, "challenge");
    }
    const credentialId = response.id;
    const stored = await prisma.webAuthnCredential.findUnique({
      where: { credentialId },
    });
    if (!stored) return fail(request, `passkey-verify:${intent}`, "passkey");
    if (intent === "step-up") {
      const session = await readActiveSession();
      if (!session || session.userId !== stored.userId) {
        return fail(request, `passkey-verify:${intent}`, "session");
      }
    } else if ((await enrollment()) !== "ready") {
      return jsonError(409, "FINISH SETUP");
    }

    const verified = await verifyAuthenticationResponse({
      response: response as AuthenticationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: stored.credentialId,
        publicKey: new Uint8Array(stored.publicKey),
        counter: Number(stored.counter),
        transports: stored.transports,
      },
    });
    if (!verified.verified) {
      return fail(request, `passkey-verify:${intent}`, "passkey");
    }
    await prisma.webAuthnCredential.update({
      where: { credentialId: stored.credentialId },
      data: { counter: BigInt(verified.authenticationInfo.newCounter) },
    });

    if (intent === "step-up") {
      const session = await readActiveSession();
      if (!session) return jsonError(401, "ACCESS DENIED");
      await touchReauth(session.id);
      await writeAudit({
        action: "auth.step_up",
        outcome: "success",
        source: "web",
        actor: session.userId,
        metadata: { method: "passkey", ipHash: clientIpHash(request) },
      });
      return Response.json(
        { status: "ok" },
        { headers: { "cache-control": "no-store" } },
      );
    }

    await openSession(stored.userId, "passkey");
    await writeAudit({
      action: "auth.sign_in",
      outcome: "success",
      source: "web",
      actor: stored.userId,
      metadata: { method: "passkey", ipHash: clientIpHash(request) },
    });
    return Response.json(
      { status: "ok" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "[arrol-auth]",
      error instanceof Error ? error.message : "passkey verify",
    );
    return fail(request, `passkey-verify:${intent}`, "passkey");
  }
}

export async function totpVerify(
  request: Request,
  intent: AuthIntent | "reveal",
  setupTokenValue: unknown,
  code: unknown,
) {
  const denied = await begin(request, `totp:${intent}`);
  if (denied) return denied;

  try {
    const state = await enrollment();
    if (intent === "setup" || intent === "reveal") {
      if (!setupOk(setupTokenValue)) {
        return fail(request, `totp:${intent}`, "setup-token");
      }
      if (state !== "needs-totp") {
        return jsonError(409, state === "ready" ? "SETUP CLOSED" : "NOT ENROLLED");
      }
      const totp = await prisma.totpSecret.findFirst();
      const user = totp
        ? await prisma.user.findUnique({ where: { id: totp.userId } })
        : null;
      if (!totp || !user) return jsonError(409, "NOT ENROLLED");
      const secret = decryptString(
        totp.ciphertext,
        requiredEnv("ARROL_ENCRYPTION_KEY"),
      );
      if (intent === "reveal") {
        return Response.json(
          { status: "totp", secret, uri: totpUri(user.email, secret) },
          { headers: { "cache-control": "no-store" } },
        );
      }
      if (typeof code !== "string" || !totpMatches(secret, code)) {
        return fail(request, `totp:${intent}`, "totp");
      }
      await prisma.totpSecret.update({
        where: { userId: user.id },
        data: { verifiedAt: new Date() },
      });
      await openSession(user.id, "totp");
      await writeAudit({
        action: "auth.sign_in",
        outcome: "success",
        source: "web",
        actor: user.id,
        metadata: { method: "totp-enroll", ipHash: clientIpHash(request) },
      });
      return Response.json(
        { status: "ok" },
        { headers: { "cache-control": "no-store" } },
      );
    }

    if (intent === "step-up") {
      const session = await readActiveSession();
      if (!session) return jsonError(401, "ACCESS DENIED");
      const totp = await prisma.totpSecret.findUnique({
        where: { userId: session.userId },
      });
      if (!totp?.verifiedAt) return fail(request, `totp:${intent}`, "totp");
      const secret = decryptString(
        totp.ciphertext,
        requiredEnv("ARROL_ENCRYPTION_KEY"),
      );
      if (typeof code !== "string" || !totpMatches(secret, code)) {
        return fail(request, `totp:${intent}`, "totp");
      }
      await touchReauth(session.id);
      await writeAudit({
        action: "auth.step_up",
        outcome: "success",
        source: "web",
        actor: session.userId,
        metadata: { method: "totp", ipHash: clientIpHash(request) },
      });
      return Response.json(
        { status: "ok" },
        { headers: { "cache-control": "no-store" } },
      );
    }

    if (state !== "ready") {
      return jsonError(409, state === "needs-passkey" ? "NOT ENROLLED" : "FINISH SETUP");
    }
    const totp = await prisma.totpSecret.findFirst({ where: { verifiedAt: { not: null } } });
    if (!totp) return fail(request, `totp:${intent}`, "totp");
    const secret = decryptString(totp.ciphertext, requiredEnv("ARROL_ENCRYPTION_KEY"));
    if (typeof code !== "string" || !totpMatches(secret, code)) {
      return fail(request, `totp:${intent}`, "totp");
    }
    await openSession(totp.userId, "totp");
    await writeAudit({
      action: "auth.sign_in",
      outcome: "success",
      source: "web",
      actor: totp.userId,
      metadata: { method: "totp", ipHash: clientIpHash(request) },
    });
    return Response.json(
      { status: "ok" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "[arrol-auth]",
      error instanceof Error ? error.message : "totp",
    );
    return fail(request, `totp:${intent}`, "totp");
  }
}
