import { HudShell } from "@/components/hud/shell";
import { HudTelemetryProvider } from "@/components/hud/telemetry";
import { listEnabledModels } from "@/lib/models";
import { requireSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import type { ReactNode } from "react";

export default async function ConsoleLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireSession();

  let timezone = "Europe/London";
  let fxOn = true;
  let modelLabel = "NONE";
  let linkUp = true;

  try {
    const [settings, models] = await Promise.all([
      getSettings(),
      listEnabledModels(),
    ]);
    timezone = settings.timezone;
    fxOn = settings.crt_effects;
    const chatId = settings.task_models.chat;
    const assigned = chatId
      ? models.find((model) => model.id === chatId)
      : models[0];
    modelLabel = assigned?.display_name ?? "NONE";
  } catch {
    linkUp = false;
  }

  return (
    <HudTelemetryProvider>
      <HudShell
        timezone={timezone}
        modelLabel={modelLabel}
        linkUp={linkUp}
        fxOn={fxOn}
      >
        {children}
      </HudShell>
    </HudTelemetryProvider>
  );
}
