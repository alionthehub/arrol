"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createModel,
  updateModel,
  type ModelFormState,
} from "./actions";
import { HudFrame } from "@/components/hud/chrome";
import { PROVIDER_TYPES, type Model } from "@/lib/model-types";

const initialState: ModelFormState = { status: "idle" };

export function ModelForm({ model }: { model?: Model | null }) {
  const isEdit = Boolean(model);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateModel : createModel,
    initialState,
  );

  return (
    <HudFrame title={isEdit ? `EDIT ${model?.display_name}` : "ADD MODEL"}>
      <form action={formAction} className="grid gap-4">
        {model ? <input type="hidden" name="id" value={model.id} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="DISPLAY_NAME">
            <input
              className="hud-field"
              name="display_name"
              defaultValue={model?.display_name}
              required
              placeholder="Claude Sonnet"
            />
          </Field>

          <Field label="PROVIDER_TYPE">
            <select
              className="hud-field"
              name="provider_type"
              defaultValue={model?.provider_type ?? "anthropic"}
              required
            >
              {PROVIDER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>

          <Field label="BASE_URL">
            <input
              className="hud-field"
              name="base_url"
              type="url"
              defaultValue={model?.base_url ?? ""}
              placeholder="https://api.anthropic.com"
            />
          </Field>

          <Field label="MODEL_ID">
            <input
              className="hud-field"
              name="model_id"
              defaultValue={model?.model_id}
              required
              placeholder="claude-sonnet-4-5"
            />
          </Field>

          <Field label="KEY_ENV_VAR">
            <input
              className="hud-field"
              name="key_env_var"
              defaultValue={model?.key_env_var}
              required
              pattern="^[A-Z][A-Z0-9_]*$"
              placeholder="ANTHROPIC_API_KEY"
              title="Environment variable name only, e.g. ANTHROPIC_API_KEY"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="mt-1 block text-[10px] font-normal tracking-widest text-amber">
              VARIABLE NAME ONLY — DO NOT PASTE AN API KEY
            </span>
          </Field>

          <Field label="ALLOWED_TASKS">
            <input
              className="hud-field"
              name="allowed_tasks"
              defaultValue={model?.allowed_tasks.join(", ") ?? ""}
              placeholder="chat, today, wall"
            />
          </Field>
        </div>

        <label className="hud-mono flex items-center gap-2 text-[10px] tracking-[0.2em] text-cyan/70">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={model?.enabled ?? true}
            className="hud-check"
          />
          ENABLED
        </label>

        {state.status === "error" ? (
          <p className="hud-mono text-sm text-stale" role="alert">
            ! {state.message}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="hud-btn">
            {pending ? "WRITING…" : isEdit ? "SAVE" : "ADD MODEL"}
          </button>
          {isEdit ? (
            <Link
              href="/admin/models"
              className="hud-mono text-[10px] tracking-[0.2em] text-cyan/70 hover:text-cyan"
            >
              CANCEL
            </Link>
          ) : null}
        </div>
      </form>
    </HudFrame>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="hud-mono text-[10px] tracking-[0.2em] text-cyan/70">
      {label}
      {children}
    </label>
  );
}
