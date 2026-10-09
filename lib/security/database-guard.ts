export function databaseHost(url: string | undefined) {
  if (!url?.startsWith("postgres") || !url.includes("@")) return "";
  const hostPort = url.split("@")[1]?.split("/")[0]?.split("?")[0] ?? "";
  return hostPort.split(":")[0]?.replace("-pooler", "").toLowerCase() ?? "";
}

export function assertDevDatabase(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === "production") return;
  const current = databaseHost(env.DATABASE_URL);
  const production = (env.ARROL_PRODUCTION_DATABASE_HOST ?? "")
    .trim()
    .toLowerCase()
    .replace("-pooler", "");
  if (current && production && current === production) {
    throw new Error("Refusing to use the production database outside production.");
  }
}
