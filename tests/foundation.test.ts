import { readdirSync, readFileSync, statSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET as health } from "@/app/api/health/route";
import { proxy } from "@/proxy";
import { persistAudit } from "@/lib/security/audit";
import {
  issueSessionCookieValue,
  readSessionCookie,
  sessionCookieOptions,
} from "@/lib/security/cookie";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/security/constants";
import { decideAccess } from "@/lib/security/guard";
import { SECURITY_HEADERS } from "@/lib/security/headers";
import { openSecret, sealSecret, type KeyRing } from "@/lib/security/cipher";
import { assertDevDatabase } from "@/lib/security/database-guard";
import { anyRateLimited, advanceRateLimit, rateLimitBlocked } from "@/lib/security/rate-limit";
import { generateRecoveryCodes, hashRecoveryCode } from "@/lib/security/recovery";
import { setupRequest } from "@/lib/security/setup-gate";
import { hashApiToken, rejectUnlessScope, scopeDecision } from "@/lib/security/tokens";
import { findingsIn, scanTracked } from "../scripts/check-secrets.mjs";
import { findingsInBundle } from "../scripts/check-client-bundle.mjs";

const ROOT = process.cwd();

function appRoutes(dir = path.join(ROOT, "app"), parts: string[] = []): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      const nextParts =
        entry.startsWith("(") && entry.endsWith(")") ? parts : [...parts, entry];
      routes.push(...appRoutes(full, nextParts));
      continue;
    }
    if (entry !== "page.tsx" && entry !== "route.ts") continue;
    const url = `/${parts.join("/")}`.replace(/\/$/, "") || "/";
    routes.push(url);
  }
  return routes;
}

function unauthenticated(pathname: string) {
  return proxy(
    new NextRequest(`https://console.example${pathname}`, {
      headers: { "x-forwarded-proto": "https" },
    }),
  );
}

describe("route gate", () => {
  const routes = appRoutes();

  it("discovers the console and API routes", () => {
    expect(routes).toEqual(
      expect.arrayContaining([
        "/",
        "/login",
        "/today",
        "/chat",
        "/settings",
        "/wall",
        "/admin/models",
        "/api/health",
        "/api/voice",
        "/api/speak",
        "/api/transcribe",
      ]),
    );
  });

  it("sends unauthenticated requests to login or 401, except health and the login ceremony", () => {
    expect(routes.length).toBeGreaterThan(8);
    for (const route of routes) {
      const decision = decideAccess(route, { session: false, bearer: false });
      const response = unauthenticated(route);
      if (
        route === "/login" ||
        route === "/api/health" ||
        route.startsWith("/api/auth/") ||
        route.startsWith("/api/setup/")
      ) {
        expect(decision).toEqual({ type: "allow" });
        expect(response.status).toBe(200);
        continue;
      }
      if (route.startsWith("/api/")) {
        expect(decision).toEqual({ type: "unauthorized" });
        expect(response.status).toBe(401);
        continue;
      }
      expect(decision).toEqual({ type: "redirect", to: "/login" });
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://console.example/login");
    }
  });
});

describe("health", () => {
  it("returns only ok", async () => {
    const response = health();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    expect(response.headers.get("content-type")).toContain("text/plain");
  });
});

describe("api tokens", () => {
  it("rejects a token that lacks the required scope", async () => {
    expect(scopeDecision(["reminders:write"], "voice:invoke")).toBe("forbidden");
    expect(scopeDecision(null, "voice:invoke")).toBe("anonymous");
    const forbidden = rejectUnlessScope(["reminders:write"], "voice:invoke");
    const anonymous = rejectUnlessScope(null, "voice:invoke");
    expect(forbidden?.status).toBe(403);
    expect(anonymous?.status).toBe(401);
    expect(await forbidden?.json()).toEqual({ error: "FORBIDDEN" });
    expect(readFileSync(path.join(ROOT, "app/api/voice/route.ts"), "utf8")).toContain(
      'rejectUnlessScope(token?.scopes ?? null, "voice:invoke")',
    );
  });

  it("stores only a hash", () => {
    const hash = hashApiToken("arrol_example");
    expect(hash).not.toContain("arrol_example");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("audit", () => {
  it("writes a row with a timestamp and source", async () => {
    const rows: unknown[] = [];
    const now = new Date("2026-10-09T18:00:00.000Z");
    const row = await persistAudit(
      async (entry) => {
        rows.push(entry);
      },
      {
        action: "auth.sign_in",
        outcome: "failure",
        source: "web",
        metadata: { reason: "totp" },
      },
      now,
    );
    expect(rows).toEqual([row]);
    expect(row.createdAt).toBe(now);
    expect(row.source).toBe("web");
    expect(row.outcome).toBe("failure");
  });

  it("is called for sign-in and for create, update, and revoke", () => {
    const files = [
      "lib/security/auth-flow.ts",
      "app/(console)/settings/actions.ts",
      "app/(console)/settings/token-actions.ts",
      "app/(console)/admin/models/actions.ts",
    ];
    for (const file of files) {
      expect(readFileSync(path.join(ROOT, file), "utf8")).toContain("writeAudit");
    }
    const auth = readFileSync(path.join(ROOT, "lib/security/auth-flow.ts"), "utf8");
    expect(auth).toContain('action: "auth.sign_in"');
    expect(auth).toContain('outcome: "failure"');
    expect(auth).toContain('outcome: "success"');
  });
});

describe("session cookie", () => {
  it("is httpOnly, secure in production, sameSite lax, and short lived", () => {
    const options = sessionCookieOptions({ NODE_ENV: "production" });
    expect(options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    expect(SESSION_MAX_AGE_SECONDS).toBeLessThanOrEqual(2 * 60 * 60);
  });

  it("rejects a tampered or expired cookie", () => {
    const secret = "s".repeat(40);
    const now = 1_700_000_000;
    const value = issueSessionCookieValue("a".repeat(32), now + 60, secret);
    expect(readSessionCookie(value, secret, now)?.sessionId).toBe("a".repeat(32));
    expect(readSessionCookie(`${value}x`, secret, now)).toBeNull();
    expect(readSessionCookie(value, secret, now + 61)).toBeNull();
    expect(readSessionCookie(value, "t".repeat(40), now)).toBeNull();
  });
});

describe("rate limit", () => {
  const options = { limit: 5, windowMs: 15 * 60 * 1000, lockoutMs: 15 * 60 * 1000 };

  it("allows five failures, then locks the bucket for 15 minutes", () => {
    let state: { windowStartMs: number; count: number; lockedUntilMs: number | null } | null =
      null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(rateLimitBlocked(state, 0, options)).toBe(false);
      const step = advanceRateLimit(state, 0, options);
      expect(step.blocked).toBe(false);
      state = step.next;
    }
    expect(state?.count).toBe(5);
    expect(state?.lockedUntilMs).toBe(options.lockoutMs);
    expect(rateLimitBlocked(state, options.lockoutMs - 1, options)).toBe(true);
    const duringLock = advanceRateLimit(state, 1_000, options);
    expect(duringLock.blocked).toBe(true);
    expect(rateLimitBlocked(state, options.lockoutMs, options)).toBe(false);
  });

  it("locks when either the IP bucket or the account bucket is exhausted", () => {
    const open = rateLimitBlocked(null, 0, options);
    const locked = rateLimitBlocked(
      { windowStartMs: 0, count: 5, lockedUntilMs: options.lockoutMs },
      0,
      options,
    );
    expect(anyRateLimited([open, locked])).toBe(true);
    expect(anyRateLimited([open, false])).toBe(false);
    const auth = readFileSync(path.join(ROOT, "lib/security/auth-flow.ts"), "utf8");
    expect(auth).toContain('sha256Hex(`${purpose}:ip:${clientIpHash(request)}`)');
    expect(auth).toContain('sha256Hex(`${purpose}:account:${accountLabel()}`)');
    expect(auth).toContain("prisma.loginAttempt.upsert");
  });
});

describe("setup closure", () => {
  it("returns 404 for every setup path once owner setup is complete", () => {
    expect(setupRequest(true)?.status).toBe(404);
    expect(setupRequest(false)).toBeNull();
    const route = readFileSync(path.join(ROOT, "app/api/setup/[...path]/route.ts"), "utf8");
    expect(route).toContain("setupRequest(await isSetupComplete())");
    expect(readFileSync(path.join(ROOT, "lib/security/auth-flow.ts"), "utf8")).toContain(
      "ownerState",
    );
  });
});

describe("recovery codes", () => {
  it("stores a hash and never the displayed code", () => {
    const [code] = generateRecoveryCodes(1);
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const hash = hashRecoveryCode(code);
    expect(hash).not.toContain(code.replace(/-/g, ""));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    const auth = readFileSync(path.join(ROOT, "lib/security/auth-flow.ts"), "utf8");
    expect(auth).toContain('action: "auth.recovery_code"');
    expect(auth).toContain("if (!row || row.usedAt)");
    expect(auth).toContain("usedAt: new Date()");
  });
});

describe("encryption key versions", () => {
  it("decrypts a previous version after rotation and seals with the current id", () => {
    const previous = Buffer.alloc(32, 1).toString("base64");
    const current = Buffer.alloc(32, 2).toString("base64");
    const before: KeyRing = { current: { id: "1", key: previous } };
    const stored = sealSecret("totp-secret", before);
    expect(stored.startsWith("v1:")).toBe(true);
    const after: KeyRing = {
      current: { id: "2", key: current },
      previous: { id: "1", key: previous },
    };
    expect(openSecret(stored, after)).toBe("totp-secret");
    expect(sealSecret("totp-secret", after).startsWith("v2:")).toBe(true);
    expect(openSecret(sealSecret("totp-secret", after), after)).toBe("totp-secret");
    const legacy = stored.slice(stored.indexOf(":") + 1);
    expect(openSecret(legacy, before)).toBe("totp-secret");
    expect(readFileSync(path.join(ROOT, "lib/security/crypto.ts"), "utf8")).toContain(
      "ARROL_ENCRYPTION_KEY_PREVIOUS",
    );
  });
});

describe("development database guard", () => {
  it("throws when a non-production process points at the production host", () => {
    expect(() =>
      assertDevDatabase({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        DATABASE_URL: "postgres://user:secret@ep-example-pooler.region.aws.neon.tech/app",
        ARROL_PRODUCTION_DATABASE_HOST: "ep-example.region.aws.neon.tech",
      } as NodeJS.ProcessEnv),
    ).toThrow(/production database/);
    expect(() =>
      assertDevDatabase({
        VERCEL_ENV: "preview",
        DATABASE_URL: "postgres://user:secret@dev.example/app",
        ARROL_PRODUCTION_DATABASE_HOST: "prod.example",
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
    expect(() =>
      assertDevDatabase({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        DATABASE_URL: "postgres://user:secret@prod.example/app",
        ARROL_PRODUCTION_DATABASE_HOST: "prod.example",
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
    expect(() =>
      assertDevDatabase({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        POSTGRES_URL: "postgres://user:secret@other.example/app",
      } as NodeJS.ProcessEnv),
    ).toThrow(/DATABASE_URL is unset/);
    expect(() =>
      assertDevDatabase({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
    ).toThrow(/DATABASE_URL is unset/);
    const migrate = readFileSync(path.join(ROOT, "scripts/migrate-if-configured.mjs"), "utf8");
    expect(migrate).toContain("DATABASE_URL is unset. Refusing to run outside production.");
    expect(migrate).not.toContain("Skipping prisma migrate");
  });
});

describe("no legacy password or baked-in domain", () => {
  it("has no legacy password env or baked-in deployment host in source", () => {
    const password = ["ARROL", "PASSWORD"].join("_");
    const domain = ["arrol", "vercel.app"].join(".");
    const hits = sourceFiles(ROOT).filter((file) => {
      const text = readFileSync(file, "utf8");
      return text.includes(password) || text.includes(domain);
    });
    expect(hits).toEqual([]);
    const webauthn = readFileSync(path.join(ROOT, "lib/security/env.ts"), "utf8");
    expect(webauthn).toContain('requiredEnv("WEBAUTHN_RP_ID")');
    expect(webauthn).toContain('requiredEnv("WEBAUTHN_ORIGIN")');
  });
});

describe("secrets stay out of git and the client", () => {
  it("flags a secret-looking string and accepts the repo", () => {
    const sample = `const key = "${"sk-"}${"proj-"}${"a".repeat(24)}"`;
    expect(findingsIn("leak.ts", sample).map((finding) => finding.name)).toContain(
      "openai-key",
    );
    expect(findingsIn(".env.example", "ARROL_SETUP_TOKEN=\n")).toEqual([]);
    expect(findingsIn(".env.example", "ARROL_SETUP_TOKEN=abc\n")).toEqual([
      { file: ".env.example", name: "ARROL_SETUP_TOKEN" },
    ]);
    expect(scanTracked()).toEqual([]);
  });

  it("flags a secret planted in a client bundle", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "arrol-bundle-"));
    writeFileSync(path.join(dir, "app.js"), `const leak = "${"sk-"}${"ant-"}${"b".repeat(24)}";`);
    expect(findingsInBundle(dir).map((finding) => finding.name)).toContain("openai-key");
  });

  it("does not reference server secrets from client components", () => {
    const files = walk(path.join(ROOT, "app")).concat(walk(path.join(ROOT, "components")));
    const clients = files.filter((file) => {
      const text = readFileSync(file, "utf8");
      return text.includes('"use client"') || text.includes("'use client'");
    });
    expect(clients.length).toBeGreaterThan(0);
    for (const file of clients) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/process\.env\.(ARROL_|DATABASE_URL|OPENAI_|ANTHROPIC_|ELEVENLABS_)/);
      expect(text).not.toMatch(/@\/lib\/(prisma|db|security\/(auth-flow|crypto|env|audit-log|api-tokens))/);
    }
  });
});

describe("headers", () => {
  it("sets the required security headers", () => {
    const keys = Object.fromEntries(SECURITY_HEADERS.map((header) => [header.key, header.value]));
    expect(keys["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(keys["Strict-Transport-Security"]).toContain("max-age=");
    expect(keys["X-Frame-Options"]).toBe("DENY");
    expect(keys["Referrer-Policy"]).toBe("no-referrer");
    expect(keys["Permissions-Policy"]).toContain("microphone=(self)");
  });
});

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

function sourceFiles(dir: string): string[] {
  const skip = new Set(["node_modules", ".next", ".git", "coverage"]);
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...sourceFiles(full));
    else if (/\.(ts|tsx|mjs|md|json|example|prisma|sql)$/.test(entry)) files.push(full);
  }
  return files;
}
