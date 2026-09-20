"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { authenticate, type LoginState } from "./actions";

const HANDSHAKE = [
  "ARROL OPS CONSOLE",
  "LINK ............... WAIT",
  "LINK ............... UP",
  "VOICE .............. STANDBY",
  "CORE ............... READY",
];

const initialState: LoginState = { status: "idle" };

export function LoginGate({
  passwordConfigured,
}: {
  passwordConfigured: boolean;
}) {
  const [booting, setBooting] = useState(true);
  const [visible, setVisible] = useState(0);
  const [password, setPassword] = useState("");
  const skipped = useRef(false);
  const [state, formAction, pending] = useActionState(authenticate, initialState);

  useEffect(() => {
    if (sessionStorage.getItem("arrol_boot_seen") !== "1") return;
    skipped.current = true;
    const id = window.setTimeout(() => {
      setBooting(false);
      setVisible(HANDSHAKE.length);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    function skip() {
      skipped.current = true;
      sessionStorage.setItem("arrol_boot_seen", "1");
      setVisible(HANDSHAKE.length);
      setBooting(false);
    }

    function onKey(event: KeyboardEvent) {
      if (!booting) return;
      event.preventDefault();
      skip();
    }

    function onPointer() {
      if (booting) skip();
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [booting]);

  useEffect(() => {
    if (!booting || skipped.current) return;
    if (visible >= HANDSHAKE.length) {
      sessionStorage.setItem("arrol_boot_seen", "1");
      const id = window.setTimeout(() => setBooting(false), 280);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setVisible((n) => n + 1), 90);
    return () => window.clearTimeout(id);
  }, [booting, visible]);

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
        {booting ? (
          <button
            type="button"
            className="hud-mono mb-4 text-left text-[10px] tracking-[0.28em] text-cyan/45 hover:text-cyan"
            onClick={() => {
              skipped.current = true;
              sessionStorage.setItem("arrol_boot_seen", "1");
              setVisible(HANDSHAKE.length);
              setBooting(false);
            }}
          >
            ANY KEY SKIPS
          </button>
        ) : (
          <p className="hud-mono mb-4 text-[10px] tracking-[0.28em] text-cyan/45">
            GATE OPEN
          </p>
        )}

        <div className="hud-mono space-y-1 text-[12px] tracking-[0.18em] text-cyan/80">
          {HANDSHAKE.slice(0, visible).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        {!booting ? (
          <div className="mt-8">
            {!passwordConfigured || state.status === "unset" ? (
              <p className="hud-mono text-stale" role="alert">
                FATAL: ARROL_PASSWORD UNSET
                <br />
                SET THE ENVIRONMENT VARIABLE AND RESTART.
              </p>
            ) : (
              <form action={formAction} className="space-y-4">
                <label className="hud-mono block text-[10px] tracking-[0.22em] text-cyan/70">
                  AUTHENTICATE
                  <input
                    className="hud-field"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    autoFocus
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={pending}
                    aria-label="Password"
                  />
                </label>
                {pending ? (
                  <p className="hud-mono text-[11px] tracking-[0.2em] text-cyan/55">
                    VERIFYING
                  </p>
                ) : null}
                {state.status === "denied" ? (
                  <p
                    className="hud-mono text-lg tracking-[0.28em] text-stale"
                    role="alert"
                  >
                    ACCESS DENIED
                  </p>
                ) : null}
                <button type="submit" className="hud-btn" disabled={pending}>
                  ENGAGE
                </button>
              </form>
            )}
          </div>
        ) : (
          <p className="hud-mono mt-6 text-[11px] tracking-[0.22em] text-cyan/45">
            INIT
          </p>
        )}

        {!booting ? (
          <p className="hud-mono mt-16 text-[10px] tracking-[0.22em] text-cyan/35">
            SESSION COOKIE · 30 DAYS · HTTPONLY
          </p>
        ) : null}
      </div>
    </div>
  );
}
