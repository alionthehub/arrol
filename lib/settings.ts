import { query } from "@/lib/db";
import { TASK_KEYS, type TaskKey } from "@/lib/tasks";

export type AppSettings = {
  display_name: string;
  timezone: string;
  crt_effects: boolean;
  task_models: Partial<Record<TaskKey, number>>;
};

const DEFAULT_SETTINGS: AppSettings = {
  display_name: "OPERATOR",
  timezone: "Europe/London",
  crt_effects: true,
  task_models: {},
};

const CREATE_SETTINGS_TABLE = `
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  display_name TEXT NOT NULL DEFAULT 'OPERATOR',
  timezone TEXT NOT NULL DEFAULT 'Europe/London',
  crt_effects BOOLEAN NOT NULL DEFAULT TRUE,
  task_models JSONB NOT NULL DEFAULT '{}'::jsonb
)
`;

let schemaReady: Promise<void> | null = null;

export async function ensureSettingsTable() {
  if (!schemaReady) {
    schemaReady = query(CREATE_SETTINGS_TABLE)
      .then(async () => {
        await query(
          `INSERT INTO settings (id, display_name, timezone, crt_effects, task_models)
           VALUES (1, $1, $2, $3, $4::jsonb)
           ON CONFLICT (id) DO NOTHING`,
          [
            DEFAULT_SETTINGS.display_name,
            DEFAULT_SETTINGS.timezone,
            DEFAULT_SETTINGS.crt_effects,
            JSON.stringify(DEFAULT_SETTINGS.task_models),
          ],
        );
      })
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  await schemaReady;
}

function parseTaskModels(raw: unknown): Partial<Record<TaskKey, number>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Partial<Record<TaskKey, number>> = {};
  for (const key of TASK_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
      result[key] = value;
    }
  }
  return result;
}

type SettingsRow = {
  display_name: string;
  timezone: string;
  crt_effects: boolean;
  task_models: unknown;
};

export async function getSettings(): Promise<AppSettings> {
  await ensureSettingsTable();
  const { rows } = await query<SettingsRow>(
    `SELECT display_name, timezone, crt_effects, task_models FROM settings WHERE id = 1`,
  );
  const row = rows[0];
  if (!row) return DEFAULT_SETTINGS;
  return {
    display_name: row.display_name || DEFAULT_SETTINGS.display_name,
    timezone: row.timezone || DEFAULT_SETTINGS.timezone,
    crt_effects: row.crt_effects,
    task_models: parseTaskModels(row.task_models),
  };
}

export async function updateSettings(input: AppSettings): Promise<AppSettings> {
  await ensureSettingsTable();
  const { rows } = await query<SettingsRow>(
    `UPDATE settings
     SET display_name = $1,
         timezone = $2,
         crt_effects = $3,
         task_models = $4::jsonb
     WHERE id = 1
     RETURNING display_name, timezone, crt_effects, task_models`,
    [
      input.display_name,
      input.timezone,
      input.crt_effects,
      JSON.stringify(input.task_models),
    ],
  );
  const row = rows[0];
  if (!row) return input;
  return {
    display_name: row.display_name,
    timezone: row.timezone,
    crt_effects: row.crt_effects,
    task_models: parseTaskModels(row.task_models),
  };
}
