"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TIMEZONES } from "@/lib/timezones";
import { TASK_KEYS, isTaskKey, type TaskKey } from "@/lib/tasks";
import { updateSettings, type AppSettings } from "@/lib/settings";
import { clearSessionCookie, requireSessionAction, writeCrtCookie } from "@/lib/session";

export type SettingsFormState = {
  status: "idle" | "error" | "saved";
  message?: string;
};

const initialPaths = ["/", "/today", "/chat", "/wall", "/settings", "/admin/models"];

export async function saveSettings(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireSessionAction();

  const display_name = String(formData.get("display_name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const crt_effects = formData.get("crt_effects") === "on";

  if (!display_name) {
    return { status: "error", message: "Name is required." };
  }
  if (!timezone) {
    return { status: "error", message: "Timezone is required." };
  }
  if (
    !(TIMEZONES as readonly string[]).includes(timezone) &&
    !/^[A-Za-z_]+\/[A-Za-z0-9_+\-]+$/.test(timezone)
  ) {
    return { status: "error", message: "Enter a valid IANA timezone." };
  }

  const task_models: AppSettings["task_models"] = {};
  for (const key of TASK_KEYS) {
    const raw = String(formData.get(`task_${key}`) ?? "").trim();
    if (!raw || raw === "none") continue;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return { status: "error", message: `Invalid model for ${key}.` };
    }
    if (!isTaskKey(key)) continue;
    task_models[key as TaskKey] = id;
  }

  try {
    await updateSettings({
      display_name,
      timezone,
      crt_effects,
      task_models,
    });
    await writeCrtCookie(crt_effects);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not save settings.",
    };
  }

  for (const path of initialPaths) {
    revalidatePath(path);
  }
  return { status: "saved", message: "SETTINGS WRITTEN" };
}

export async function lockTerminal() {
  await requireSessionAction();
  await clearSessionCookie();
  redirect("/login");
}
