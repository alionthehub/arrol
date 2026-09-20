"use client";

import { TerminalError } from "@/components/terminal-status";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-4">
      <TerminalError
        title="CHAT FAULT"
        message={error.message}
        onRetry={reset}
      />
    </div>
  );
}
