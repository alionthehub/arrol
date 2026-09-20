import Link from "next/link";
import { listEnabledModels } from "@/lib/models";
import { getSettings } from "@/lib/settings";
import { requireSession } from "@/lib/session";
import { ChatPanel } from "./chat-panel";

export const metadata = {
  title: "CHAT",
};

export default async function ChatPage() {
  await requireSession();
  const [models, settings] = await Promise.all([
    listEnabledModels(),
    getSettings().catch(() => null),
  ]);
  const options = models.map((model) => ({
    id: model.id,
    display_name: model.display_name,
    provider_type: model.provider_type,
  }));
  const preferred =
    settings?.task_models.chat &&
    options.some((model) => model.id === settings.task_models.chat)
      ? settings.task_models.chat
      : options[0]?.id;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {options.length === 0 ? (
        <div className="flex h-full items-center justify-center px-4">
          <p className="text-center text-sm tracking-widest text-phosphor-dim">
            NO ENABLED MODELS.{" "}
            <Link href="/admin/models" className="text-ice underline">
              CONFIGURE
            </Link>
          </p>
        </div>
      ) : (
        <ChatPanel models={options} initialModelId={preferred ?? options[0].id} />
      )}
    </div>
  );
}
