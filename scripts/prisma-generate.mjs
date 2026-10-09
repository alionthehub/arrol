import { spawnSync } from "node:child_process";

const placeholder = ["postgresql", "://", "placeholder", ":", "placeholder", "@127.0.0.1:5432/arrol"].join("");
const env = { ...process.env };
if (!env.DATABASE_URL) env.DATABASE_URL = placeholder;
if (!env.DATABASE_URL_UNPOOLED) env.DATABASE_URL_UNPOOLED = env.DATABASE_URL;

const result = spawnSync("npx", ["prisma", "generate"], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
