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
import { advanceRateLimit, rateLimitBlocked } from "@/lib/security/rate-limit";
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
    new NextRequest(`https://arrol.vercel.app${pathname}`, {
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
      if (route === "/login" || route === "/api/health" || route.startsWith("/api/auth/")) {
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
      expect(response.headers.get("location")).toBe("https://arrol.vercel.app/login");
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
  it("blocks after the failure budget", () => {
    let window: { windowStartMs: number; count: number } | null = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      expect(rateLimitBlocked(window, 0, { limit: 8, windowMs: 1000 })).toBe(false);
      window = advanceRateLimit(window, 0, { limit: 8, windowMs: 1000 }).next;
    }
    expect(rateLimitBlocked(window, 0, { limit: 8, windowMs: 1000 })).toBe(true);
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
