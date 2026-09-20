export const PROVIDER_TYPES = ["anthropic", "openai-compatible"] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

export type Model = {
  id: number;
  display_name: string;
  provider_type: ProviderType;
  base_url: string | null;
  model_id: string;
  key_env_var: string;
  allowed_tasks: string[];
  enabled: boolean;
};

export function isProviderType(value: string): value is ProviderType {
  return (PROVIDER_TYPES as readonly string[]).includes(value);
}

/** Env var names only — never an API key value. */
export const KEY_ENV_VAR_PATTERN = /^[A-Z][A-Z0-9_]*$/;
