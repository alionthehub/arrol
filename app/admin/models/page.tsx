import Link from "next/link";
import { listModels } from "@/lib/models";
import { toggleModelEnabled } from "./actions";
import { ModelForm } from "./model-form";

export const metadata = {
  title: "Models · Admin",
};

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const models = await listModels();
  const editId = Number((await searchParams).edit);
  const editing =
    Number.isInteger(editId) && editId > 0
      ? (models.find((model) => model.id === editId) ?? null)
      : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Models</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Provider configs for the app. API keys stay in environment variables;
          this page only stores the variable name.
        </p>
      </div>

      <section className="space-y-3">
        {models.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            No models yet. Add one below.
          </p>
        ) : (
          models.map((model) => (
            <article
              key={model.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="min-w-0 text-base font-semibold tracking-tight">
                  {model.display_name}
                </h2>
                <div className="flex shrink-0 items-center gap-3">
                  <Link
                    href={`/admin/models?edit=${model.id}`}
                    className="shrink-0 rounded-md border border-zinc-300 px-2.5 py-1 text-sm font-medium whitespace-nowrap dark:border-zinc-600 dark:text-zinc-50"
                  >
                    Edit
                  </Link>
                  <form action={toggleModelEnabled}>
                    <input type="hidden" name="id" value={model.id} />
                    <button
                      type="submit"
                      role="switch"
                      aria-checked={model.enabled}
                      aria-label={`${model.enabled ? "Disable" : "Enable"} ${model.display_name}`}
                      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                        model.enabled
                          ? "bg-emerald-600"
                          : "bg-zinc-300 dark:bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                          model.enabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </form>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Provider" value={model.provider_type} mono />
                <Field label="Model ID" value={model.model_id} mono />
                <Field label="Key env var" value={model.key_env_var} mono />
                <Field label="Base URL" value={model.base_url ?? "—"} />
                <Field
                  label="Allowed tasks"
                  value={
                    model.allowed_tasks.length
                      ? model.allowed_tasks.join(", ")
                      : "—"
                  }
                />
              </div>
            </article>
          ))
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          {editing ? `Edit ${editing.display_name}` : "Add model"}
        </h2>
        <ModelForm key={editing?.id ?? "new"} model={editing} />
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 break-all text-sm ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </p>
    </div>
  );
}
