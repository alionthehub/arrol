import "server-only";
import { prisma } from "@/lib/prisma";
import type { ApiScope } from "@/lib/security/constants";
import { generateApiToken, hashApiToken, readBearerToken } from "@/lib/security/tokens";

export async function lookupApiToken(request: Request) {
  const presented = readBearerToken(request);
  if (!presented.startsWith("arrol_")) return null;
  const row = await prisma.apiToken.findUnique({
    where: { tokenHash: hashApiToken(presented) },
  });
  if (!row || row.revokedAt) return null;
  await prisma.apiToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);
  return { id: row.id, name: row.name, scopes: row.scopes };
}

export async function listApiTokens() {
  return prisma.apiToken.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      scopes: true,
      createdAt: true,
      revokedAt: true,
      lastUsedAt: true,
    },
  });
}

export async function createApiToken(name: string, scopes: ApiScope[]) {
  const active = await prisma.apiToken.findFirst({
    where: { name, revokedAt: null },
  });
  if (active) {
    throw new Error("An active token already exists for that integration.");
  }
  const token = generateApiToken();
  const row = await prisma.apiToken.create({
    data: { name, scopes, tokenHash: hashApiToken(token) },
  });
  return { id: row.id, token };
}

export async function revokeApiToken(id: string) {
  const row = await prisma.apiToken.findUnique({ where: { id } });
  if (!row || row.revokedAt) return null;
  return prisma.apiToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}
