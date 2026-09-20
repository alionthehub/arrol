"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { sendChatMessage } from "./actions";
import type { ProviderType } from "@/lib/model-types";
import { AsciiSpinner, BlockCursor, TypeText, useGlitch } from "@/components/terminal";
import { MicControl } from "@/components/mic-control";
import { ToolBlock } from "@/components/tool-block";

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

export function ChatPanel({
  models,
  initialModelId,
}: {
  models: ChatModelOption[];
  initialModelId: number;
}) {
  const [modelId, setModelId] = useState(initialModelId);
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  const { glitchClass, trigger } = useGlitch();

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [turns, pending]);

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
    trigger();

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
        trigger();
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
      trigger();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`flex h-full min-h-0 flex-col ${glitchClass}`}
    >
      <div className="flex shrink-0 items-center gap-3 overflow-x-auto border-b border-phosphor/30 px-3 py-2 text-[11px] tracking-widest">
        <label className="flex items-center gap-2">
          <span className="text-phosphor-dim">MDL</span>
          <select
            className="field mt-0 w-auto min-w-40 py-0.5 text-xs"
            value={modelId}
            onChange={(event) => setModelId(Number(event.target.value))}
            disabled={pending}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.display_name} / {model.provider_type}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-auto px-3 py-3 font-mono text-sm sm:px-5"
      >
        <div className="flex flex-col gap-3">
          {turns.length === 0 && !pending ? (
            <p className="py-6 text-center text-xs tracking-widest text-phosphor-dim">
              TRANSCRIPT EMPTY
            </p>
          ) : null}
          {turns.map((turn) => (
            <article key={turn.id} className="space-y-2">
              {turn.role === "user" ? (
                <p className="whitespace-pre-wrap text-ice">
                  <span className="text-phosphor-dim">&gt; </span>
                  {turn.text}
                </p>
              ) : (
                <>
                  {turn.toolCalls?.map((call, index) => (
                    <ToolBlock
                      key={`${turn.id}-${call.name}-${index}`}
                      name={call.name}
                      args={call.arguments}
                      result={call.result}
                      isError={call.isError}
                    />
                  ))}
                  <TypeText
                    as="p"
                    className="whitespace-pre-wrap text-phosphor"
                    text={turn.text}
                  />
                  {turn.hitIterationCap ? (
                    <p className="text-xs tracking-widest text-amber">
                      STOPPED AT ITERATION CAP
                    </p>
                  ) : null}
                </>
              )}
            </article>
          ))}
          {pending ? (
            <p className="text-amber">
              <AsciiSpinner label="AGENT LOOP" />
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="px-3 text-sm text-deny" role="alert">
          ! {error}
        </p>
      ) : null}

      <div className="shrink-0 border-t border-phosphor/30 px-3 py-3 sm:px-5">
        <div className="mx-auto flex max-w-none flex-col items-center gap-3">
          <MicControl />
          <div className="flex w-full items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Message</span>
              <div className="flex items-start gap-2">
                <span className="mt-2 text-ice" aria-hidden="true">
                  &gt;
                </span>
                <textarea
                  name="message"
                  rows={2}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  disabled={pending}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="enter command"
                  className="field mt-0 min-h-[3rem] flex-1 resize-none"
                />
                {draft.length === 0 && !pending ? (
                  <span className="mt-2 hidden sm:inline">
                    <BlockCursor />
                  </span>
                ) : null}
              </div>
            </label>
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              className="term-btn shrink-0"
            >
              SEND
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
