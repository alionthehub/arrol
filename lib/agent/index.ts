import { anthropicAdapter } from "@/lib/agent/anthropic";
import { openaiCompatibleAdapter } from "@/lib/agent/openai-compatible";
import type { ProviderAdapter } from "@/lib/agent/types";
import type { ProviderType } from "@/lib/model-types";

export function getAdapter(providerType: ProviderType): ProviderAdapter {
  if (providerType === "anthropic") return anthropicAdapter;
  return openaiCompatibleAdapter;
}
