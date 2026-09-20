"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  KEY_ENV_VAR_PATTERN,
  isProviderType,
  type ProviderType,
} from "@/lib/model-types";
import {
  createModelRow,
  toggleModelRow,
  updateModelRow,
  type ModelInput,
} from "@/lib/models";

export type ModelFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  token?: string;
};

const MODELS_PATH = "/admin/models";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseAllowedTasks(raw: string) {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((task) => task.trim())
        .filter(Boolean),
    ),
  ];
}

function looksLikeApiKey(value: string) {
  return value.startsWith("sk-") || value.startsWith("Bearer ");
}

function parseModelInput(formData: FormData): ModelInput {
  const display_name = readString(formData, "display_name");
  const providerRaw = readString(formData, "provider_type");
  const baseUrlRaw = readString(formData, "base_url");
  const model_id = readString(formData, "model_id");
  const key_env_var = readString(formData, "key_env_var");
  const allowed_tasks = parseAllowedTasks(readString(formData, "allowed_tasks"));
  const enabled = formData.get("enabled") === "on";

  if (!display_name) {
    throw new Error("Display name is required.");
  }
  if (!isProviderType(providerRaw)) {
    throw new Error("Provider type must be anthropic or openai-compatible.");
  }
  const provider_type: ProviderType = providerRaw;
  if (!model_id) {
    throw new Error("Model ID is required.");
  }
  if (!key_env_var) {
    throw new Error("Key environment variable name is required.");
  }
  if (looksLikeApiKey(key_env_var) || !KEY_ENV_VAR_PATTERN.test(key_env_var)) {
    throw new Error(
      "Enter the environment variable name only (e.g. ANTHROPIC_API_KEY). API keys are never stored.",
    );
  }
  if (baseUrlRaw) {
    try {
      new URL(baseUrlRaw);
    } catch {
      throw new Error("Base URL must be a valid URL.");
    }
  }

  return {
    display_name,
    provider_type,
    base_url: baseUrlRaw || null,
    model_id,
    key_env_var,
    allowed_tasks,
    enabled,
  };
}

function parseId(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid model id.");
  }
  return id;
}

export async function createModel(
  _prev: ModelFormState,
  formData: FormData,
): Promise<ModelFormState> {
  try {
    await createModelRow(parseModelInput(formData));
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not create model.",
    };
  }
  revalidatePath(MODELS_PATH);
  redirect(MODELS_PATH);
}

export async function updateModel(
  _prev: ModelFormState,
  formData: FormData,
): Promise<ModelFormState> {
  try {
    const updated = await updateModelRow(parseId(formData), parseModelInput(formData));
    if (!updated) {
      return { status: "error", message: "Model not found." };
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not update model.",
    };
  }
  revalidatePath(MODELS_PATH);
  redirect(MODELS_PATH);
}

export async function toggleModelEnabled(formData: FormData) {
  await toggleModelRow(parseId(formData));
  revalidatePath(MODELS_PATH);
}
