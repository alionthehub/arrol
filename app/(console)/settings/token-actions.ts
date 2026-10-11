"use server";

import { revalidatePath } from "next/cache";
import { createApiToken, revokeApiToken } from "@/lib/security/api-tokens";
import { writeAudit } from "@/lib/security/audit-log";
import { parseScopes, tokenNameOk } from "@/lib/security/tokens";
import { isRecentAuth, requireSessionAction } from "@/lib/session";

export type TokenActionState = {
  status: "idle" | "error" | "reauth" | "created" | "revoked";
  message?: string;
  token?: string;
};

export async function createIntegrationToken(
  _prev: TokenActionState,
  formData: FormData,
): Promise<TokenActionState> {
  const session = await requireSessionAction();
  if (!isRecentAuth(session)) {
    return {
      status: "reauth",
      message: "Re-authenticate to continue.",
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  const scopes = parseScopes(formData.getAll("scopes").map((value) => String(value)));
  if (!tokenNameOk(name)) {
    return { status: "error", message: "Use a short lowercase integration name." };
  }
  if (!scopes) {
    return { status: "error", message: "Choose at least one permission." };
  }

  try {
    const created = await createApiToken(name, scopes);
    await writeAudit({
      action: "api_token.create",
      outcome: "success",
      source: "web",
      actor: session.userId,
      subject: created.id,
      metadata: { name, scopes: scopes.join(",") },
    });
    revalidatePath("/settings");
    return {
      status: "created",
      token: created.token,
      message: "Copy this token now. It will not be shown again.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not create token.",
    };
  }
}

export async function revokeIntegrationToken(formData: FormData) {
  const session = await requireSessionAction();
  if (!isRecentAuth(session)) {
    throw new Error("Re-authenticate to continue.");
  }
  const id = String(formData.get("id") ?? "");
  const revoked = await revokeApiToken(id);
  if (!revoked) return;
  await writeAudit({
    action: "api_token.revoke",
    outcome: "success",
    source: "web",
    actor: session.userId,
    subject: revoked.id,
    metadata: { name: revoked.name },
  });
  revalidatePath("/settings");
}
