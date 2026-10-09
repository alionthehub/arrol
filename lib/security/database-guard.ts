export function databaseHost(url: string | undefined) {
  if (!url?.startsWith("postgres") || !url.includes("@")) return "";
  const hostPort = url.split("@")[1]?.split("/")[0]?.split("?")[0] ?? "";
  return hostPort.split(":")[0]?.replace("-pooler", "").toLowerCase() ?? "";
}

export function assertDevDatabase(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === "production") return;
  const url = env.DATABASE_URL;
  if (!url?.startsWith("postgres")) {
    throw new Error(
      "DATABASE_URL is unset. Refusing to run outside production.",
    );
  }
  const current = databaseHost(url);
  const production = (env.ARROL_PRODUCTION_DATABASE_HOST ?? "")
    .trim()
    .toLowerCase()
    .replace("-pooler", "");
  if (current && production && current === production) {
    throw new Error("Refusing to use the production database outside production.");
  }
}
