import { listModels } from "@/lib/models";
import { requireSession } from "@/lib/session";
import { ModelForm } from "./model-form";
import { ModelCard } from "./model-card";

export const metadata = {
  title: "MODELS",
};

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireSession();
  const models = await listModels();
  const editId = Number((await searchParams).edit);
  const editing =
    Number.isInteger(editId) && editId > 0
      ? (models.find((model) => model.id === editId) ?? null)
      : null;

  return (
    <div className="h-full overflow-auto px-3 py-4 sm:px-5">
      <div className="flex max-w-5xl flex-col gap-4">
        <header>
          <h1 className="hud-mono text-xl tracking-[0.28em] text-cyan">MODELS</h1>
          <p className="mt-1 hud-mono text-[10px] tracking-[0.22em] text-cyan/45">
            KEY_ENV_VAR STORES A VARIABLE NAME — NEVER A SECRET
          </p>
        </header>

        {models.length === 0 ? (
          <p className="hud-mono py-8 text-center text-[11px] tracking-[0.22em] text-cyan/40">
            NO PENDING ITEMS
          </p>
        ) : (
          models.map((model) => (
            <ModelCard key={model.id} model={model} />
          ))
        )}

        <ModelForm key={editing?.id ?? "new"} model={editing} />
      </div>
    </div>
  );
}
