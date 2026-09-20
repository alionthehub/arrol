"use client";

import { HudFault } from "@/components/hud/chrome";

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
      <HudFault
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
