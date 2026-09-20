"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Model } from "@/lib/model-types";
import { testModelConnection, toggleModelEnabled } from "./actions";
import { AsciiSpinner, TerminalFrame, useGlitch } from "@/components/terminal";

export function ModelCard({ model }: { model: Model }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(
    null,
  );
  const { glitchClass, trigger } = useGlitch();

  function onTest() {
    setResult(null);
    startTransition(async () => {
      const next = await testModelConnection(model.id);
      setResult(next);
      trigger();
    });
  }

  return (
    <TerminalFrame
      title={model.display_name}
      tone={model.enabled ? "phosphor" : "amber"}
      className={glitchClass}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] tracking-widest text-phosphor-dim">
          {model.enabled ? "● ENABLED" : "○ DISABLED"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/models?edit=${model.id}`} className="term-btn">
            EDIT
          </Link>
          <form action={toggleModelEnabled}>
            <input type="hidden" name="id" value={model.id} />
            <button
              type="submit"
              role="switch"
              aria-checked={model.enabled}
              aria-label={`${model.enabled ? "Disable" : "Enable"} ${model.display_name}`}
              className="term-btn"
            >
              {model.enabled ? "DISABLE" : "ENABLE"}
            </button>
          </form>
          <button
            type="button"
            className="term-btn term-btn-ice"
            onClick={onTest}
            disabled={pending}
          >
            TEST CONNECTION
          </button>
        </div>
      </div>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <Field label="PROVIDER" value={model.provider_type} />
        <Field label="MODEL_ID" value={model.model_id} />
        <Field
          label="KEY_ENV_VAR"
          value={model.key_env_var}
          hint="ENV VAR NAME — NOT A SECRET"
          ice
        />
        <Field label="BASE_URL" value={model.base_url ?? "—"} />
        <Field
          label="ALLOWED_TASKS"
          value={model.allowed_tasks.length ? model.allowed_tasks.join(", ") : "—"}
        />
      </dl>

      <div className="mt-3 text-sm" aria-live="polite">
        {pending ? <AsciiSpinner label="PING" /> : null}
        {result?.ok ? (
          <p className="text-phosphor">● ONLINE {result.detail}</p>
        ) : null}
        {result && !result.ok ? (
          <p className="text-deny">● FAILED {result.detail}</p>
        ) : null}
      </div>
    </TerminalFrame>
  );
}

function Field({
  label,
  value,
  hint,
  ice,
}: {
  label: string;
  value: string;
  hint?: string;
  ice?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="tracking-widest text-phosphor-dim">{label}</dt>
      <dd className={`mt-0.5 break-all ${ice ? "text-ice" : "text-phosphor"}`}>
        {ice ? `$${value}` : value}
      </dd>
      {hint ? (
        <p className="mt-0.5 text-[10px] tracking-widest text-amber">{hint}</p>
      ) : null}
    </div>
  );
}
