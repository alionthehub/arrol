import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index);
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

if (!process.env.DATABASE_URL?.startsWith("postgres")) {
  console.log("DATABASE_URL is not set. Skipping prisma migrate deploy.");
  process.exit(0);
}

function withoutPooler(url) {
  if (!url?.startsWith("postgres")) return url;
  return url.replace("-pooler.", ".");
}

const direct = withoutPooler(
  process.env.DATABASE_URL_UNPOOLED?.startsWith("postgres")
    ? process.env.DATABASE_URL_UNPOOLED
    : process.env.DATABASE_URL,
);
process.env.DATABASE_URL_UNPOOLED = direct;
// Neon’s pooler cannot hold a session advisory lock. The migration history
// check still runs; concurrent migrators are not expected on this database.
process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK = "1";

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
