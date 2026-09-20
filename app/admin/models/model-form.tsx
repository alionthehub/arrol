"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createModel,
  updateModel,
  type ModelFormState,
} from "@/app/admin/models/actions";
import { PROVIDER_TYPES, type Model } from "@/lib/model-types";

const initialState: ModelFormState = { status: "idle" };

const fieldClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

type ModelFormProps = {
  model?: Model | null;
};

export function ModelForm({ model }: ModelFormProps) {
  const isEdit = Boolean(model);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateModel : createModel,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-4">
      {model ? <input type="hidden" name="id" value={model.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Display name
          <input
            className={fieldClass}
            name="display_name"
            defaultValue={model?.display_name}
            required
            placeholder="Claude Sonnet"
          />
        </label>

        <label className="text-sm font-medium">
          Provider type
          <select
            className={fieldClass}
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

        <label className="text-sm font-medium">
          Base URL
          <input
            className={fieldClass}
            name="base_url"
            type="url"
            defaultValue={model?.base_url ?? ""}
            placeholder="https://api.anthropic.com"
          />
        </label>

        <label className="text-sm font-medium">
          Model ID
          <input
            className={fieldClass}
            name="model_id"
            defaultValue={model?.model_id}
            required
            placeholder="claude-sonnet-4-5"
          />
        </label>

        <label className="text-sm font-medium">
          Key env var
          <input
            className={fieldClass}
            name="key_env_var"
            defaultValue={model?.key_env_var}
            required
            pattern="^[A-Z][A-Z0-9_]*$"
            placeholder="ANTHROPIC_API_KEY"
            title="Environment variable name only, e.g. ANTHROPIC_API_KEY"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="mt-1 block text-xs font-normal text-zinc-500">
            Stores the variable name only. Never paste an API key.
          </span>
        </label>

        <label className="text-sm font-medium">
          Allowed tasks
          <input
            className={fieldClass}
            name="allowed_tasks"
            defaultValue={model?.allowed_tasks.join(", ") ?? ""}
            placeholder="chat, summarize"
          />
          <span className="mt-1 block text-xs font-normal text-zinc-500">
            Comma-separated list of tasks this model may run.
          </span>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={model?.enabled ?? true}
          className="size-4 accent-zinc-950 dark:accent-zinc-50"
        />
        Enabled
      </label>

      {state.status === "error" ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950"
        >
          {pending ? "Saving…" : isEdit ? "Save changes" : "Add model"}
        </button>
        {isEdit ? (
          <Link
            href="/admin/models"
            className="text-sm text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Cancel
          </Link>
        ) : null}
      </div>
    </form>
  );
}
