import { query } from "@/lib/db";
import {
  KEY_ENV_VAR_PATTERN,
  type Model,
  type ProviderType,
} from "@/lib/model-types";

const CREATE_MODELS_TABLE = `
CREATE TABLE IF NOT EXISTS models (
  id SERIAL PRIMARY KEY,
  display_name TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  base_url TEXT,
  model_id TEXT NOT NULL,
  key_env_var TEXT NOT NULL,
  allowed_tasks TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT models_provider_type_check
    CHECK (provider_type IN ('anthropic', 'openai-compatible')),
  CONSTRAINT models_key_env_var_check
    CHECK (key_env_var ~ '^[A-Z][A-Z0-9_]*$')
)
`;

let schemaReady: Promise<void> | null = null;

export async function ensureModelsTable() {
  if (!schemaReady) {
    schemaReady = query(CREATE_MODELS_TABLE)
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  await schemaReady;
}

export type ModelInput = {
  display_name: string;
  provider_type: ProviderType;
  base_url: string | null;
  model_id: string;
  key_env_var: string;
  allowed_tasks: string[];
  enabled: boolean;
};

export function assertKeyEnvVar(value: string) {
  if (!KEY_ENV_VAR_PATTERN.test(value)) {
    throw new Error(
      "key_env_var must be an environment variable name (e.g. ANTHROPIC_API_KEY). Do not store API keys in the database.",
    );
  }
}

export async function listModels(): Promise<Model[]> {
  await ensureModelsTable();
  const { rows } = await query<Model>(
    `SELECT id, display_name, provider_type, base_url, model_id, key_env_var, allowed_tasks, enabled
     FROM models
     ORDER BY display_name ASC, id ASC`,
  );
  return rows;
}

export async function createModelRow(input: ModelInput): Promise<Model> {
  await ensureModelsTable();
  assertKeyEnvVar(input.key_env_var);
  const { rows } = await query<Model>(
    `INSERT INTO models (
       display_name, provider_type, base_url, model_id, key_env_var, allowed_tasks, enabled
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, display_name, provider_type, base_url, model_id, key_env_var, allowed_tasks, enabled`,
    [
      input.display_name,
      input.provider_type,
      input.base_url,
      input.model_id,
      input.key_env_var,
      input.allowed_tasks,
      input.enabled,
    ],
  );
  return rows[0];
}

export async function updateModelRow(
  id: number,
  input: ModelInput,
): Promise<Model | null> {
  await ensureModelsTable();
  assertKeyEnvVar(input.key_env_var);
  const { rows } = await query<Model>(
    `UPDATE models
     SET display_name = $2,
         provider_type = $3,
         base_url = $4,
         model_id = $5,
         key_env_var = $6,
         allowed_tasks = $7,
         enabled = $8
     WHERE id = $1
     RETURNING id, display_name, provider_type, base_url, model_id, key_env_var, allowed_tasks, enabled`,
    [
      id,
      input.display_name,
      input.provider_type,
      input.base_url,
      input.model_id,
      input.key_env_var,
      input.allowed_tasks,
      input.enabled,
    ],
  );
  return rows[0] ?? null;
}

export async function toggleModelRow(id: number): Promise<Model | null> {
  await ensureModelsTable();
  const { rows } = await query<Model>(
    `UPDATE models
     SET enabled = NOT enabled
     WHERE id = $1
     RETURNING id, display_name, provider_type, base_url, model_id, key_env_var, allowed_tasks, enabled`,
    [id],
  );
  return rows[0] ?? null;
}
