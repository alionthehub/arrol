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

function databaseHost(url) {
  if (!url?.startsWith("postgres") || !url.includes("@")) return "";
  const hostPort = url.split("@")[1]?.split("/")[0]?.split("?")[0] ?? "";
  return hostPort.split(":")[0]?.replace("-pooler", "").toLowerCase() ?? "";
}

if (process.env.VERCEL_ENV !== "production") {
  const production = (process.env.ARROL_PRODUCTION_DATABASE_HOST ?? "")
    .trim()
    .toLowerCase()
    .replace("-pooler", "");
  if (!production) {
    console.error(
      "ARROL_PRODUCTION_DATABASE_HOST is unset. Refusing to run outside production.",
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL?.startsWith("postgres")) {
    console.error("DATABASE_URL is unset. Refusing to run outside production.");
    process.exit(1);
  }
  const current = databaseHost(process.env.DATABASE_URL);
  if (!current || current === production) {
    console.error("Refusing to use the production database outside production.");
    process.exit(1);
  }
}

if (!process.env.DATABASE_URL?.startsWith("postgres")) {
  console.error("DATABASE_URL is unset. Refusing to migrate.");
  process.exit(1);
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
