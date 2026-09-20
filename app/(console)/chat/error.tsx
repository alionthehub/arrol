"use client";

import { HudFault } from "@/components/hud/chrome";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-4">
      <HudFault title="CORE FAULT" message={error.message} onRetry={reset} />
    </div>
  );
}
