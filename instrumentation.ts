export async function register() {
  const { assertDevDatabase } = await import("@/lib/security/database-guard");
  assertDevDatabase();
}
