"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { authenticate, type LoginState } from "./actions";
import { BlockCursor, TypeText } from "@/components/terminal";
import { TerminalInput } from "@/components/terminal-field";

const BOOT_LINES = [
  "ARROL BIOS v1.87  —  COPYRIGHT 1987-2026",
  "CPU CHECK ................. OK",
  "MEMORY CHECK .............. 640K OK",
  "ROM CHECKSUM .............. PASS",
  "LOADING KERNEL ............ arrol.sys",
  "MOUNTING VOLUMES .......... /today /chat /wall",
  "DATABASE HANDSHAKE ........ WAIT",
  "DATABASE HANDSHAKE ........ OK",
  "MODULE timekeeper ......... LOADED",
  "MODULE agent_loop ......... LOADED",
  "MODULE voice .............. OFFLINE",
  "NETWORK INTERFACE ......... LINK UP",
  "SYSTEM READY.",
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
      setVisible(BOOT_LINES.length);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    function skip() {
      skipped.current = true;
      sessionStorage.setItem("arrol_boot_seen", "1");
      setVisible(BOOT_LINES.length);
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
    if (visible >= BOOT_LINES.length) {
      sessionStorage.setItem("arrol_boot_seen", "1");
      const id = window.setTimeout(() => setBooting(false), 280);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setVisible((n) => n + 1), 90);
    return () => window.clearTimeout(id);
  }, [booting, visible]);

  return (
    <div
      key={state.stamp ?? "gate"}
      className={`flex min-h-dvh flex-col bg-void px-4 py-6 text-sm text-phosphor sm:px-6 ${state.status === "denied" ? "screen-shake" : ""}`}
    >
      <div className="flex w-full max-w-4xl flex-1 flex-col">
        {booting ? (
          <button
            type="button"
            className="mb-4 text-left text-[11px] tracking-[0.25em] text-phosphor-dim hover:text-phosphor"
            onClick={() => {
              skipped.current = true;
              sessionStorage.setItem("arrol_boot_seen", "1");
              setVisible(BOOT_LINES.length);
              setBooting(false);
            }}
          >
            ANY KEY SKIPS BOOT
          </button>
        ) : (
          <p className="mb-4 text-[11px] tracking-[0.25em] text-phosphor-dim">
            GATE OPEN
          </p>
        )}
        <div className="space-y-0.5 font-mono">
          {BOOT_LINES.slice(0, visible).map((line) => (
            <p key={line} className="crt-glow">
              {line}
            </p>
          ))}
        </div>

        {!booting ? (
          <div className="mt-8 space-y-4">
            {!passwordConfigured || state.status === "unset" ? (
              <p className="text-deny" role="alert">
                FATAL: ARROL_PASSWORD UNSET
                <br />
                SET THE ENVIRONMENT VARIABLE AND RESTART.
              </p>
            ) : (
              <form action={formAction} className="space-y-3">
                <label className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="shrink-0 tracking-widest">AUTHENTICATE:</span>
                  <TerminalInput
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    autoFocus
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={pending}
                    className="max-w-sm"
                    aria-label="Password"
                  />
                </label>
                {pending ? (
                  <p className="text-phosphor-dim">
                    VERIFYING
                    <BlockCursor />
                  </p>
                ) : null}
                {state.status === "denied" ? (
                  <p className="text-lg tracking-[0.2em] text-deny" role="alert">
                    ACCESS DENIED
                  </p>
                ) : null}
                <button type="submit" className="term-btn" disabled={pending}>
                  ENGAGE
                </button>
              </form>
            )}
          </div>
        ) : (
          <p className="mt-6 text-phosphor-dim">
            INIT
            <BlockCursor />
          </p>
        )}

        {!booting ? (
          <TypeText
            className="mt-auto pt-10 text-[11px] tracking-widest text-phosphor-dim"
            text="SESSION COOKIE · 30 DAYS · HTTPONLY"
          />
        ) : null}
      </div>
    </div>
  );
}
