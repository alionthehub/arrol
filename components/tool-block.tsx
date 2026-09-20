"use client";

import { useState } from "react";
import { AsciiSpinner, TerminalFrame } from "@/components/terminal";

export function ToolBlock({
  name,
  args,
  result,
  isError,
  running,
}: {
  name: string;
  args?: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  running?: boolean;
}) {
  const [open, setOpen] = useState(true);

  return (
    <TerminalFrame title={`[TOOL] ${name}`} tone={isError ? "amber" : "ice"}>
      <button
        type="button"
        className="mb-1 text-left text-[11px] tracking-widest text-ice-dim hover:text-ice"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {open ? "▾ COLLAPSE" : "▸ EXPAND"}
      </button>
      {running ? (
        <p className="text-sm">
          <AsciiSpinner />
        </p>
      ) : null}
      {open ? (
        <div className="space-y-1 text-xs">
          {args ? (
            <p className="whitespace-pre-wrap break-all">
              <span className="text-phosphor-dim">ARGS </span>
              {JSON.stringify(args)}
            </p>
          ) : null}
          {result ? (
            <p
              className={`whitespace-pre-wrap break-all ${isError ? "text-deny" : "text-phosphor"}`}
            >
              <span className="text-phosphor-dim">RESULT </span>
              {result}
            </p>
          ) : null}
        </div>
      ) : null}
    </TerminalFrame>
  );
}
