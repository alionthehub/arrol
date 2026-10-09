"use server";

import { regenerateRecoveryCodes } from "@/lib/security/auth-flow";

export type RecoveryActionState = {
  status: "idle" | "reauth" | "created";
  message?: string;
  codes?: string[];
};

export async function regenerateRecovery(
  prev: RecoveryActionState,
  formData: FormData,
): Promise<RecoveryActionState> {
  void prev;
  void formData;
  const result = await regenerateRecoveryCodes();
  if (result.status === "reauth") {
    return { status: "reauth", message: result.message };
  }
  return {
    status: "created",
    codes: result.codes,
    message: "Save these codes now. The previous set no longer works.",
  };
}
