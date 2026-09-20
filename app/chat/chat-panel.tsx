"use client";

import { useState, useTransition, type FormEvent } from "react";
import { sendChatMessage } from "@/app/chat/actions";
import type { ProviderType } from "@/lib/model-types";

export type ChatModelOption = {
  id: number;
  display_name: string;
  provider_type: ProviderType;
};

type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result: string;
    isError: boolean;
  }>;
  hitIterationCap?: boolean;
};

export function ChatPanel({ models }: { models: ChatModelOption[] }) {
  const [modelId, setModelId] = useState(models[0]?.id ?? 0);
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || pending) return;

    const userTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role: "user",
      text: message,
    };
    const history = turns.map((turn) => ({ role: turn.role, text: turn.text }));

    setDraft("");
    setError(null);
    setTurns((current) => [...current, userTurn]);

    startTransition(async () => {
      const result = await sendChatMessage({
        modelId,
        message,
        history,
      });
      if (!result.ok) {
        setTurns((current) => current.filter((turn) => turn.id !== userTurn.id));
        setDraft(message);
        setError(result.error);
        return;
      }
      setTurns((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: result.text || "(empty response)",
          toolCalls: result.toolCalls,
          hitIterationCap: result.hitIterationCap,
        },
      ]);
    });
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm font-medium">
          Model
          <select
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={modelId}
            onChange={(event) => setModelId(Number(event.target.value))}
            disabled={pending}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.display_name} ({model.provider_type})
              </option>
            ))}
          </select>
        </label>

        <div className="flex-1 space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          {turns.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Send a message. If the model needs the time, it can call
              get_current_time.
            </p>
          ) : (
            turns.map((turn) => (
              <article key={turn.id} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {turn.role === "user" ? "You" : "Assistant"}
                </p>
                {turn.toolCalls && turn.toolCalls.length > 0 ? (
                  <ul className="space-y-2">
                    {turn.toolCalls.map((call, index) => (
                      <li
                        key={`${turn.id}-${call.name}-${index}`}
                        className="rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        <p className="font-semibold text-zinc-950 dark:text-zinc-50">
                          Tool: {call.name}
                        </p>
                        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                          args {JSON.stringify(call.arguments)}
                        </p>
                        <p
                          className={`mt-1 whitespace-pre-wrap ${
                            call.isError
                              ? "text-red-600 dark:text-red-400"
                              : "text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          result {call.result}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="whitespace-pre-wrap text-sm">{turn.text}</p>
                {turn.hitIterationCap ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Stopped at the 10-iteration cap.
                  </p>
                ) : null}
              </article>
            ))
          )}
        </div>

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <label className="text-sm font-medium">
          Message
          <textarea
            name="message"
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={pending}
            placeholder="What time is it in London?"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="self-start rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950"
        >
          {pending ? "Running…" : "Send"}
        </button>
      </form>
    </div>
  );
}
