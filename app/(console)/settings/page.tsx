import { listEnabledModels } from "@/lib/models";
import { getSettings } from "@/lib/settings";
import { requireSession } from "@/lib/session";
import { SettingsForm } from "./settings-form";

export const metadata = {
  title: "SETTINGS",
};

export default async function SettingsPage() {
  await requireSession();
  const [settings, models] = await Promise.all([
    getSettings(),
    listEnabledModels().catch(() => []),
  ]);

  return (
    <div className="h-full overflow-auto px-3 py-4 sm:px-5">
      <div className="max-w-3xl">
        <SettingsForm
          settings={settings}
          models={models.map((model) => ({
            id: model.id,
            display_name: model.display_name,
          }))}
        />
      </div>
    </div>
  );
}
