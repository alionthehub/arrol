import { ConsoleShell } from "@/components/status-bars";
import { listEnabledModels } from "@/lib/models";
import { requireSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { PROCESS_STARTED_AT } from "@/lib/uptime";
import type { ReactNode } from "react";

export default async function ConsoleLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireSession();

  let operator = "OPERATOR";
  let timezone = "Europe/London";
  let crtOn = true;
  let modelLabel = "NONE";
  let linkUp = true;

  try {
    const [settings, models] = await Promise.all([
      getSettings(),
      listEnabledModels(),
    ]);
    operator = settings.display_name;
    timezone = settings.timezone;
    crtOn = settings.crt_effects;
    const chatId = settings.task_models.chat;
    const assigned = chatId
      ? models.find((model) => model.id === chatId)
      : models[0];
    modelLabel = assigned?.display_name ?? "NONE";
  } catch {
    linkUp = false;
  }

  return (
    <ConsoleShell
      startedAt={PROCESS_STARTED_AT}
      timezone={timezone}
      operator={operator}
      modelLabel={modelLabel}
      linkUp={linkUp}
      crtOn={crtOn}
    >
      {children}
    </ConsoleShell>
  );
}
