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
          background: "#000",
          color: "#3dff6e",
          fontFamily: "ui-monospace, monospace",
          padding: 24,
        }}
      >
        <p style={{ letterSpacing: "0.2em" }}>! SYSTEM FAULT</p>
        <p style={{ marginTop: 12 }}>{error.message}</p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 16,
            border: "1px solid #3dff6e",
            background: "transparent",
            color: "#3dff6e",
            padding: "8px 12px",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          RETRY
        </button>
      </body>
    </html>
  );
}
