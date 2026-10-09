import { listEnabledModels } from "@/lib/models";
import { listApiTokens } from "@/lib/security/api-tokens";
import { getSettings } from "@/lib/settings";
import { isRecentAuth, requireSession } from "@/lib/session";
import { AccessPanel } from "./access-panel";
import { SettingsForm } from "./settings-form";

export const metadata = {
  title: "SETTINGS",
};

export default async function SettingsPage() {
  const session = await requireSession();
  const [settings, models, tokens] = await Promise.all([
    getSettings(),
    listEnabledModels().catch(() => []),
    listApiTokens().catch(() => []),
  ]);

  return (
    <div className="h-full overflow-auto px-3 py-4 sm:px-5">
      <div className="max-w-3xl space-y-4">
        <SettingsForm
          settings={settings}
          models={models.map((model) => ({
            id: model.id,
            display_name: model.display_name,
          }))}
        />
        <AccessPanel
          recent={isRecentAuth(session)}
          tokens={tokens.map((token) => ({
            id: token.id,
            name: token.name,
            scopes: token.scopes,
            createdAt: token.createdAt.toISOString(),
            revokedAt: token.revokedAt?.toISOString() ?? null,
            lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
          }))}
        />
      </div>
    </div>
  );
}
