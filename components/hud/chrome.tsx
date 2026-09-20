import type { ReactNode } from "react";

export function HudFrame({
  title,
  children,
  side = "left",
}: {
  title: string;
  children: ReactNode;
  side?: "left" | "right";
}) {
  return (
    <section data-side={side} className="hud-card px-4 py-3">
      <header className="mb-3 flex items-baseline gap-2">
        <h2 className="hud-mono text-[10px] tracking-[0.22em] text-cyan">
          {title}
        </h2>
        <span className="h-px min-w-4 flex-1 bg-cyan/20" />
      </header>
      {children}
    </section>
  );
}

export function HudFault({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="hud-card space-y-3 px-4 py-4 text-stale"
      data-side="left"
      role="alert"
    >
      <p className="hud-mono tracking-[0.22em]">! {title}</p>
      <p className="font-light text-ink">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="hud-btn">
          RETRY
        </button>
      ) : null}
    </div>
  );
}

export function HudLoading({ label }: { label: string }) {
  return (
    <p className="hud-mono px-4 py-6 text-[11px] tracking-[0.22em] text-cyan/55" aria-live="polite">
      {label}
    </p>
  );
}
