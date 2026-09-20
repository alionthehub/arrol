import Link from "next/link";
import { listEnabledModels } from "@/lib/models";
import { ChatPanel } from "./chat-panel";

export const metadata = {
  title: "Chat",
};

export default async function ChatPage() {
  const models = await listEnabledModels();
  const options = models.map((model) => ({
    id: model.id,
    display_name: model.display_name,
    provider_type: model.provider_type,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Messages go through the agent loop on the server. API keys are read
          from environment variables and never stored in the database.
        </p>
      </div>

      {options.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          No enabled models.{" "}
          <Link href="/admin/models" className="font-medium underline">
            Add one in admin
          </Link>
          .
        </p>
      ) : (
        <ChatPanel models={options} />
      )}
    </div>
  );
}
