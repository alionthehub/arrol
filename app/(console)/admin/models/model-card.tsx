"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Model } from "@/lib/model-types";
import { testModelConnection, toggleModelEnabled } from "./actions";
import { HudFrame } from "@/components/hud/chrome";

export function ModelCard({ model }: { model: Model }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(
    null,
  );

  function onTest() {
    setResult(null);
    startTransition(async () => {
      const next = await testModelConnection(model.id);
      setResult(next);
    });
  }

  return (
    <HudFrame title={model.display_name}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="hud-mono flex items-center gap-2 text-[10px] tracking-[0.2em] text-cyan/55">
          <span className={model.enabled ? "led" : "led led-off"} />
          {model.enabled ? "ENABLED" : "DISABLED"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/models?edit=${model.id}`} className="hud-btn">
            EDIT
          </Link>
          <form action={toggleModelEnabled}>
            <input type="hidden" name="id" value={model.id} />
            <button
              type="submit"
              role="switch"
              aria-checked={model.enabled}
              aria-label={`${model.enabled ? "Disable" : "Enable"} ${model.display_name}`}
              className="hud-btn"
            >
              {model.enabled ? "DISABLE" : "ENABLE"}
            </button>
          </form>
          <button
            type="button"
            className="hud-btn"
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
          accent
        />
        <Field label="BASE_URL" value={model.base_url ?? "—"} />
        <Field
          label="ALLOWED_TASKS"
          value={model.allowed_tasks.length ? model.allowed_tasks.join(", ") : "—"}
        />
      </dl>

      <div className="mt-3 text-sm" aria-live="polite">
        {pending ? (
          <p className="hud-mono text-[11px] tracking-widest text-cyan/55">PING</p>
        ) : null}
        {result?.ok ? (
          <p className="hud-mono text-ok">● ONLINE {result.detail}</p>
        ) : null}
        {result && !result.ok ? (
          <p className="hud-mono text-stale">● FAILED {result.detail}</p>
        ) : null}
      </div>
    </HudFrame>
  );
}

function Field({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="hud-mono tracking-widest text-cyan/45">{label}</dt>
      <dd
        className={`mt-0.5 break-all font-light ${accent ? "text-cyan" : "text-ink"}`}
      >
        {accent ? `$${value}` : value}
      </dd>
      {hint ? (
        <p className="mt-0.5 hud-mono text-[10px] tracking-widest text-amber">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
