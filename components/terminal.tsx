"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";

export function TerminalFrame({
  title,
  children,
  className = "",
  tone = "phosphor",
}: {
  title: string;
  children: ReactNode;
  className?: string;
  tone?: "phosphor" | "amber" | "ice";
}) {
  const headingId = useId();
  const color =
    tone === "amber"
      ? "text-amber"
      : tone === "ice"
        ? "text-ice"
        : "text-phosphor";

  return (
    <section
      className={`crt-scan-in min-w-0 overflow-hidden ${color} ${className}`}
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className="sr-only">
        {title}
      </h2>
      <div
        className="flex w-full min-w-0 items-center font-mono leading-none select-none"
        aria-hidden="true"
      >
        <span className="shrink-0">┌─ {title} </span>
        <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap">
          {"─".repeat(120)}
        </span>
        <span className="shrink-0">┐</span>
      </div>
      <div className="border-x border-current px-3 py-2">{children}</div>
      <div
        className="flex w-full min-w-0 items-center font-mono leading-none select-none"
        aria-hidden="true"
      >
        <span className="shrink-0">└</span>
        <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap">
          {"─".repeat(120)}
        </span>
        <span className="shrink-0">┘</span>
      </div>
    </section>
  );
}

export function TypeText({
  text,
  className = "",
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  as?: "span" | "p" | "h1" | "h2";
}) {
  const [output, setOutput] = useState("");

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    raf = requestAnimationFrame(() => {
      if (cancelled) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const crt = document.documentElement.dataset.crt !== "off";
      if (reduced || !crt || text.length === 0) {
        setOutput(text);
        return;
      }

      const total = Math.min(380, Math.max(120, text.length * 12));
      const started = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const t = Math.min(1, (now - started) / total);
        setOutput(text.slice(0, Math.ceil(t * text.length)));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [text]);

  return (
    <Tag className={className} aria-label={text}>
      {output}
    </Tag>
  );
}

export function CountUp({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const [n, setN] = useState(0);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    raf = requestAnimationFrame(() => {
      if (cancelled) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const crt = document.documentElement.dataset.crt !== "off";
      if (reduced || !crt) {
        setN(value);
        return;
      }
      const total = 320;
      const started = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const t = Math.min(1, (now - started) / total);
        setN(Math.round(t * value));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return <span className={className}>{String(n).padStart(2, "0")}</span>;
}

export function BlockCursor({ className = "" }: { className?: string }) {
  return <span className={`cursor-block ${className}`} aria-hidden="true" />;
}

export function AsciiSpinner({ label = "RUNNING" }: { label?: string }) {
  const frames = ["|", "/", "-", "\\"];
  const [i, setI] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = window.setInterval(() => {
      setI((current) => (current + 1) % frames.length);
    }, 90);
    return () => window.clearInterval(id);
  }, [frames.length]);

  return (
    <span className="inline-flex items-center gap-2 text-amber" aria-live="polite">
      <span aria-hidden="true">[{frames[i]}]</span>
      <span>{label}</span>
    </span>
  );
}

export function useGlitch() {
  const [on, setOn] = useState(false);

  const trigger = useCallback(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const crt = document.documentElement.dataset.crt !== "off";
    if (reduced || !crt) return;
    setOn(true);
    window.setTimeout(() => setOn(false), 180);
  }, []);

  return { glitchClass: on ? "crt-glitch" : "", trigger };
}
