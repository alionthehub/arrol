"use client";

import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Enrollment = "needs-passkey" | "needs-totp" | "reenroll" | "ready";

type TotpHandoff = { secret: string; uri: string };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | { error?: string }
    | null;
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data ? data.error : undefined;
    throw new Error(message || "ACCESS DENIED");
  }
  return data as T;
}

export function LoginGate({
  enrollment,
}: {
  enrollment: Enrollment | "offline";
}) {
  const [setupToken, setSetupToken] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [totp, setTotp] = useState<TotpHandoff | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [mode, setMode] = useState<"passkey" | "totp" | "recovery">("passkey");
  const router = useRouter();

  async function run(task: () => Promise<void>) {
    setPending(true);
    setError("");
    try {
      await task();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ACCESS DENIED");
    } finally {
      setPending(false);
    }
  }

  async function registerPasskey() {
    await run(async () => {
      const options = await postJson<PublicKeyCredentialCreationOptionsJSON>(
        "/api/setup/passkey/options",
        { setupToken },
      );
      const attestation = await startRegistration({ optionsJSON: options });
      const verified = await postJson<{ secret?: string; uri?: string }>(
        "/api/setup/passkey/verify",
        {
        setupToken,
        response: attestation,
      });
      if (!verified.secret || !verified.uri) {
        throw new Error("AUTHENTICATOR SETUP FAILED");
      }
      setTotp({ secret: verified.secret, uri: verified.uri });
    });
  }

  async function revealTotp() {
    await run(async () => {
      const revealed = await postJson<{ secret?: string; uri?: string }>("/api/setup/totp", {
        intent: "reveal",
        setupToken,
      });
      if (!revealed.secret || !revealed.uri) {
        throw new Error("AUTHENTICATOR SETUP FAILED");
      }
      setTotp({ secret: revealed.secret, uri: revealed.uri });
    });
  }

  async function confirmTotp() {
    await run(async () => {
      const confirmed = await postJson<{ recoveryCodes?: string[] }>("/api/setup/totp", {
        intent: "setup",
        setupToken,
        code,
      });
      if (confirmed.recoveryCodes?.length) {
        setRecoveryCodes(confirmed.recoveryCodes);
        return;
      }
      router.push("/today");
      router.refresh();
    });
  }

  async function signInPasskey() {
    await run(async () => {
      const options = await postJson<PublicKeyCredentialRequestOptionsJSON>(
        "/api/auth/passkey/options",
        { intent: "sign-in" },
      );
      const assertion = await startAuthentication({ optionsJSON: options });
      await postJson("/api/auth/passkey/verify", {
        intent: "sign-in",
        response: assertion,
      });
      router.push("/today");
      router.refresh();
    });
  }

  async function signInTotp() {
    await run(async () => {
      const result = await postJson<{ status?: string }>("/api/auth/totp", {
        intent: "sign-in",
        code,
      });
      if (result.status === "reenroll") {
        setReplacing(true);
        setCode("");
        return;
      }
      router.push("/today");
      router.refresh();
    });
  }

  async function signInRecovery() {
    await run(async () => {
      const result = await postJson<{ status?: string }>("/api/auth/recovery", { code });
      if (result.status !== "reenroll") {
        throw new Error("ACCESS DENIED");
      }
      setReplacing(true);
      setCode("");
    });
  }

  async function registerReplacement() {
    await run(async () => {
      const options = await postJson<PublicKeyCredentialCreationOptionsJSON>(
        "/api/auth/passkey/options",
        { intent: "reenroll" },
      );
      const attestation = await startRegistration({ optionsJSON: options });
      await postJson("/api/auth/passkey/verify", {
        intent: "reenroll",
        response: attestation,
      });
      router.push("/today");
      router.refresh();
    });
  }

  const settingUp =
    enrollment === "needs-passkey" || enrollment === "needs-totp" || totp !== null;

  return (
    <div className="relative z-10 flex min-h-dvh flex-col px-4 py-6 sm:px-6">
      <header className="hud-strip border">
        <span className="hud-cell text-cyan">ARROL</span>
        <span className="hud-cell">
          <span className="led" />
          AUTH
        </span>
      </header>

      <div className="mx-auto mt-16 w-full max-w-lg">
        <p className="hud-mono mb-4 text-[10px] tracking-[0.28em] text-cyan/45">
          SINGLE OWNER
        </p>
        <h1 className="hud-mono text-xl tracking-[0.28em] text-cyan">
          {settingUp ? "ENROLL" : "AUTHENTICATE"}
        </h1>

        {enrollment === "offline" ? (
          <p className="hud-mono mt-8 text-stale" role="alert">
            LINK DOWN
          </p>
        ) : null}

        {enrollment === "needs-passkey" && !totp ? (
          <div className="mt-8 space-y-4">
            <label className="hud-mono block text-[10px] tracking-[0.22em] text-cyan/70">
              SETUP TOKEN
              <input
                className="hud-field"
                type="password"
                autoComplete="off"
                value={setupToken}
                onChange={(event) => setSetupToken(event.target.value)}
                disabled={pending}
              />
            </label>
            <button
              type="button"
              className="hud-btn"
              disabled={pending || setupToken.length < 32}
              onClick={() => void registerPasskey()}
            >
              {pending ? "WAITING…" : "REGISTER PASSKEY"}
            </button>
          </div>
        ) : null}

        {enrollment === "needs-totp" && !totp ? (
          <div className="mt-8 space-y-4">
            <p className="font-light text-[13px] text-ink/70">
              Passkey is stored. Finish the authenticator app before the console opens.
            </p>
            <label className="hud-mono block text-[10px] tracking-[0.22em] text-cyan/70">
              SETUP TOKEN
              <input
                className="hud-field"
                type="password"
                autoComplete="off"
                value={setupToken}
                onChange={(event) => setSetupToken(event.target.value)}
                disabled={pending}
              />
            </label>
            <button
              type="button"
              className="hud-btn"
              disabled={pending || setupToken.length < 32}
              onClick={() => void revealTotp()}
            >
              {pending ? "WAITING…" : "SHOW AUTHENTICATOR KEY"}
            </button>
          </div>
        ) : null}

        {recoveryCodes ? (
          <div className="mt-8 space-y-4">
            <p className="font-light text-[13px] text-ink/70">
              Save these recovery codes. Each one works once, and this is the only time they are shown.
            </p>
            <ul className="space-y-2">
              {recoveryCodes.map((recoveryCode) => (
                <li
                  key={recoveryCode}
                  className="hud-mono text-[13px] tracking-[0.18em] text-cyan"
                >
                  {recoveryCode}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="hud-btn"
              onClick={() => {
                router.push("/today");
                router.refresh();
              }}
            >
              I SAVED THESE CODES
            </button>
          </div>
        ) : null}

        {totp && !recoveryCodes ? (
          <div className="mt-8 space-y-4">
            <p className="font-light text-[13px] text-ink/70">
              Add this key to an authenticator app, then enter the 6-digit code.
            </p>
            <p className="hud-mono break-all text-[12px] tracking-[0.14em] text-cyan">
              {totp.secret}
            </p>
            <p className="hud-mono break-all text-[10px] tracking-[0.08em] text-cyan/50">
              {totp.uri}
            </p>
            <label className="hud-mono block text-[10px] tracking-[0.22em] text-cyan/70">
              AUTHENTICATOR CODE
              <input
                className="hud-field"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={pending}
              />
            </label>
            <button
              type="button"
              className="hud-btn"
              disabled={pending || code.replace(/\s/g, "").length !== 6}
              onClick={() => void confirmTotp()}
            >
              {pending ? "VERIFYING…" : "CONFIRM AND ENTER"}
            </button>
          </div>
        ) : null}

        {(enrollment === "ready" || enrollment === "reenroll" || replacing) &&
        !totp &&
        !recoveryCodes ? (
          <div className="mt-8 space-y-4">
            {enrollment === "reenroll" || replacing ? (
              <p className="font-light text-[13px] text-ink/70">
                This recovery code removed the previous passkey. Register a new one before the console opens.
              </p>
            ) : null}
            {mode === "passkey" || enrollment === "reenroll" || replacing ? (
              <button
                type="button"
                className="hud-btn"
                disabled={pending}
                onClick={() =>
                  void (enrollment === "reenroll" || replacing
                    ? registerReplacement()
                    : signInPasskey())
                }
              >
                {pending
                  ? "WAITING…"
                  : enrollment === "reenroll" || replacing
                    ? "REGISTER PASSKEY"
                    : "SIGN IN WITH PASSKEY"}
              </button>
            ) : null}
            {mode === "totp" && enrollment !== "reenroll" && !replacing ? (
              <>
                <label className="hud-mono block text-[10px] tracking-[0.22em] text-cyan/70">
                  AUTHENTICATOR CODE
                  <input
                    className="hud-field"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    disabled={pending}
                  />
                </label>
                <button
                  type="button"
                  className="hud-btn"
                  disabled={pending || code.replace(/\s/g, "").length !== 6}
                  onClick={() => void signInTotp()}
                >
                  {pending ? "VERIFYING…" : "SIGN IN WITH CODE"}
                </button>
              </>
            ) : null}
            {mode === "recovery" && enrollment !== "reenroll" && !replacing ? (
              <>
                <label className="hud-mono block text-[10px] tracking-[0.22em] text-cyan/70">
                  RECOVERY CODE
                  <input
                    className="hud-field"
                    autoComplete="off"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    disabled={pending}
                  />
                </label>
                <button
                  type="button"
                  className="hud-btn"
                  disabled={pending || code.replace(/[^a-zA-Z0-9]/g, "").length !== 12}
                  onClick={() => void signInRecovery()}
                >
                  {pending ? "VERIFYING…" : "USE RECOVERY CODE"}
                </button>
              </>
            ) : null}
            {enrollment !== "reenroll" && !replacing ? (
              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  className="hud-mono text-[10px] tracking-[0.22em] text-cyan/50"
                  onClick={() => {
                    setMode((current) => (current === "passkey" ? "totp" : "passkey"));
                    setError("");
                  }}
                >
                  {mode === "passkey" ? "USE AUTHENTICATOR INSTEAD" : "USE PASSKEY"}
                </button>
                <button
                  type="button"
                  className="hud-mono text-[10px] tracking-[0.22em] text-cyan/50"
                  onClick={() => {
                    setMode("recovery");
                    setCode("");
                    setError("");
                  }}
                >
                  USE RECOVERY CODE
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="hud-mono mt-6 text-lg tracking-[0.28em] text-stale" role="alert">
            {error}
          </p>
        ) : null}

        <p className="hud-mono mt-16 text-[10px] tracking-[0.22em] text-cyan/35">
          SESSION · 2 HOURS · HTTPONLY · SECURE · SAMESITE=LAX
        </p>
      </div>
    </div>
  );
}
