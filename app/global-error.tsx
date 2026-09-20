"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#01060b",
          color: "#4ae3ff",
          fontFamily: '"Share Tech Mono", ui-monospace, monospace',
          padding: 24,
        }}
      >
        <p style={{ letterSpacing: "0.22em" }}>! SYSTEM FAULT</p>
        <p style={{ marginTop: 12, color: "#d7f6ff", fontWeight: 300 }}>{error.message}</p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 16,
            border: "1px solid #4ae3ff",
            background: "transparent",
            color: "#4ae3ff",
            padding: "8px 12px",
            fontFamily: "inherit",
            letterSpacing: "0.18em",
            cursor: "pointer",
          }}
        >
          RETRY
        </button>
      </body>
    </html>
  );
}
