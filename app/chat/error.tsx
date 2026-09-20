"use client";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-white p-6 dark:border-red-900 dark:bg-zinc-900">
      <h1 className="text-lg font-semibold">Could not load chat</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {error.message}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-950"
      >
        Try again
      </button>
    </div>
  );
}
