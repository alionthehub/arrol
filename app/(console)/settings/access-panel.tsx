"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useActionState, useState } from "react";
import { HudFrame } from "@/components/hud/chrome";
import { API_SCOPES } from "@/lib/security/constants";
import {
  createIntegrationToken,
  revokeIntegrationToken,
  type TokenActionState,
} from "./token-actions";

type TokenRow = {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

const initialState: TokenActionState = { status: "idle" };

export function AccessPanel({
  tokens,
  recent,
}: {
  tokens: TokenRow[];
  recent: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    createIntegrationToken,
    initialState,
  );
  const [stepUp, setStepUp] = useState("");
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);

  async function confirmPasskey() {
    setWorking(true);
    setStepUp("");
    try {
      const optionsResponse = await fetch("/api/auth/passkey/options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: "step-up" }),
      });
      if (!optionsResponse.ok) throw new Error("ACCESS DENIED");
      const options = await optionsResponse.json();
      const assertion = await startAuthentication({ optionsJSON: options });
      const verified = await fetch("/api/auth/passkey/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: "step-up", response: assertion }),
      });
      if (!verified.ok) throw new Error("ACCESS DENIED");
      window.location.reload();
    } catch (error) {
      setStepUp(error instanceof Error ? error.message : "ACCESS DENIED");
    } finally {
      setWorking(false);
    }
  }

  async function registerPasskey() {
    setWorking(true);
    setStepUp("");
    try {
      const optionsResponse = await fetch("/api/auth/passkey/options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: "enroll" }),
      });
      if (!optionsResponse.ok) throw new Error("REAUTH REQUIRED");
      const options = await optionsResponse.json();
      const attestation = await startRegistration({ optionsJSON: options });
      const verified = await fetch("/api/auth/passkey/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: "enroll", response: attestation }),
      });
      if (!verified.ok) throw new Error("ACCESS DENIED");
      setStepUp("PASSKEY STORED");
    } catch (error) {
      setStepUp(error instanceof Error ? error.message : "ACCESS DENIED");
    } finally {
      setWorking(false);
    }
  }

  async function confirmTotp() {
    setWorking(true);
    setStepUp("");
    try {
      const verified = await fetch("/api/auth/totp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: "step-up", code }),
      });
      if (!verified.ok) throw new Error("ACCESS DENIED");
      window.location.reload();
    } catch (error) {
      setStepUp(error instanceof Error ? error.message : "ACCESS DENIED");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-4">
      <HudFrame title="ACCESS">
        <p className="font-light text-[13px] text-ink/70">
          One token per integration. Stored as a hash. Revocation is immediate.
        </p>
        <ul className="mt-4 space-y-3">
          {tokens.length === 0 ? (
            <li className="hud-mono text-[11px] tracking-[0.18em] text-cyan/50">
              NO TOKENS
            </li>
          ) : (
            tokens.map((token) => (
              <li key={token.id} className="flex flex-wrap items-center gap-3">
                <span className="hud-mono text-[12px] tracking-[0.16em] text-cyan">
                  {token.name}
                </span>
                <span className="text-[12px] text-ink/70">
                  {token.scopes.join(" · ")}
                </span>
                <span className="hud-mono text-[10px] tracking-[0.16em] text-cyan/40">
                  {token.revokedAt ? "REVOKED" : "ACTIVE"}
                </span>
                {token.revokedAt ? null : (
                  <form action={revokeIntegrationToken}>
                    <input type="hidden" name="id" value={token.id} />
                    <button type="submit" className="hud-btn" disabled={!recent}>
                      REVOKE
                    </button>
                  </form>
                )}
              </li>
            ))
          )}
        </ul>
      </HudFrame>

      {recent ? (
        <HudFrame title="NEW TOKEN">
          <form action={formAction} className="space-y-4">
            <label className="hud-mono block text-[10px] tracking-[0.2em] text-cyan/70">
              INTEGRATION
              <input className="hud-field" name="name" placeholder="siri-shortcuts" />
            </label>
            <fieldset className="space-y-2">
              <legend className="hud-mono text-[10px] tracking-[0.2em] text-cyan/70">
                PERMISSIONS
              </legend>
              {API_SCOPES.map((scope) => (
                <label key={scope} className="flex items-center gap-3 text-[13px]">
                  <input className="hud-check" type="checkbox" name="scopes" value={scope} />
                  {scope}
                </label>
              ))}
            </fieldset>
            <button type="submit" className="hud-btn" disabled={pending}>
              {pending ? "WRITING…" : "ISSUE TOKEN"}
            </button>
            <button
              type="button"
              className="hud-btn"
              disabled={working}
              onClick={() => void registerPasskey()}
            >
              REGISTER THIS DEVICE
            </button>
          </form>
          {state.status === "created" && state.token ? (
            <p className="hud-mono mt-4 break-all text-[12px] text-ok" role="status">
              {state.message}
              <br />
              {state.token}
            </p>
          ) : null}
          {state.status === "error" || state.status === "reauth" ? (
            <p className="hud-mono mt-4 text-sm text-stale" role="alert">
              ! {state.message}
            </p>
          ) : null}
        </HudFrame>
      ) : (
        <HudFrame title="RE-AUTH">
          <p className="font-light text-[13px] text-ink/70">
            Confirm with your passkey or authenticator before issuing or revoking a token.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <button
              type="button"
              className="hud-btn"
              disabled={working}
              onClick={() => void confirmPasskey()}
            >
              PASSKEY
            </button>
            <label className="hud-mono text-[10px] tracking-[0.2em] text-cyan/70">
              CODE
              <input
                className="hud-field"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="hud-btn"
              disabled={working || code.replace(/\s/g, "").length !== 6}
              onClick={() => void confirmTotp()}
            >
              CONFIRM CODE
            </button>
          </div>
          {stepUp ? (
            <p className="hud-mono mt-4 text-sm text-stale" role="alert">
              ! {stepUp}
            </p>
          ) : null}
        </HudFrame>
      )}
    </div>
  );
}
