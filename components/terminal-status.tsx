"use client";

export function TerminalError({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="crt-scan-in space-y-3 border border-deny p-4 text-deny" role="alert">
      <p className="tracking-widest">! {title}</p>
      <p className="text-sm text-phosphor">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="term-btn">
          RETRY
        </button>
      ) : null}
    </div>
  );
}

export function TerminalLoading({ label }: { label: string }) {
  return (
    <p className="text-sm text-phosphor-dim" aria-live="polite">
      {label}
    </p>
  );
}
