import { getSettings } from "@/lib/settings";
import { requireSession } from "@/lib/session";
import { TODAY_PLACEHOLDER } from "@/lib/placeholders";
import { WallDisplay } from "./wall-display";

export const metadata = {
  title: "WALL",
};

export default async function WallPage() {
  await requireSession();
  const settings = await getSettings().catch(() => ({
    timezone: "Europe/London",
    display_name: "OPERATOR",
    crt_effects: true,
    task_models: {},
  }));

  return (
    <WallDisplay
      timezone={settings.timezone}
      operator={settings.display_name}
      readout={TODAY_PLACEHOLDER}
    />
  );
}
