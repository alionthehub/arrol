import { HudConsole } from "@/components/hud/console";
import { listEnabledModels } from "@/lib/models";
import { requireSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export async function HudRoute({ interactive }: { interactive: boolean }) {
  await requireSession();
  const [models, settings] = await Promise.all([
    listEnabledModels().catch(() => []),
    getSettings().catch(() => null),
  ]);
  const preferred =
    settings?.task_models.chat &&
    models.some((model) => model.id === settings.task_models.chat)
      ? settings.task_models.chat
      : models[0]?.id ?? null;

  return (
    <HudConsole
      modelId={preferred}
      timezone={settings?.timezone ?? "Europe/London"}
      interactive={interactive}
    />
  );
}
