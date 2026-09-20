"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createModel,
  updateModel,
  type ModelFormState,
} from "./actions";
import { PROVIDER_TYPES, type Model } from "@/lib/model-types";
import { TerminalFrame } from "@/components/terminal";

const initialState: ModelFormState = { status: "idle" };

export function ModelForm({ model }: { model?: Model | null }) {
  const isEdit = Boolean(model);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateModel : createModel,
    initialState,
  );

  return (
    <TerminalFrame title={isEdit ? `EDIT ${model?.display_name}` : "ADD MODEL"}>
      <form action={formAction} className="grid gap-4">
        {model ? <input type="hidden" name="id" value={model.id} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs tracking-widest">
            DISPLAY_NAME
            <input
              className="field"
              name="display_name"
              defaultValue={model?.display_name}
              required
              placeholder="Claude Sonnet"
            />
          </label>

          <label className="text-xs tracking-widest">
            PROVIDER_TYPE
            <select
              className="field"
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
          </label>

          <label className="text-xs tracking-widest">
            BASE_URL
            <input
              className="field"
              name="base_url"
              type="url"
              defaultValue={model?.base_url ?? ""}
              placeholder="https://api.anthropic.com"
            />
          </label>

          <label className="text-xs tracking-widest">
            MODEL_ID
            <input
              className="field"
              name="model_id"
              defaultValue={model?.model_id}
              required
              placeholder="claude-sonnet-4-5"
            />
          </label>

          <label className="text-xs tracking-widest">
            KEY_ENV_VAR
            <input
              className="field text-ice"
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
          </label>

          <label className="text-xs tracking-widest">
            ALLOWED_TASKS
            <input
              className="field"
              name="allowed_tasks"
              defaultValue={model?.allowed_tasks.join(", ") ?? ""}
              placeholder="chat, today, wall"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-xs tracking-widest">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={model?.enabled ?? true}
            className="size-4 accent-phosphor"
          />
          ENABLED
        </label>

        {state.status === "error" ? (
          <p className="text-sm text-deny" role="alert">
            ! {state.message}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="term-btn">
            {pending ? "WRITING…" : isEdit ? "SAVE" : "ADD MODEL"}
          </button>
          {isEdit ? (
            <Link href="/admin/models" className="text-xs tracking-widest text-ice">
              CANCEL
            </Link>
          ) : null}
        </div>
      </form>
    </TerminalFrame>
  );
}
