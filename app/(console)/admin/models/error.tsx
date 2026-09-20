"use client";

import { TerminalError } from "@/components/terminal-status";

export default function ModelsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const missingUrl = error.message.includes("DATABASE_URL");

  return (
    <div className="p-4">
      <TerminalError
        title="MODELS FAULT"
        message={
          missingUrl
            ? "Set DATABASE_URL in .env.local to a Postgres connection string, then retry."
            : error.message
        }
        onRetry={reset}
      />
    </div>
  );
}
