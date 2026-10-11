import "server-only";
import { prisma } from "@/lib/prisma";
import { persistAudit, type AuditInput } from "@/lib/security/audit";

export async function writeAudit(input: AuditInput) {
  return persistAudit(
    (row) => prisma.auditLog.create({ data: row }),
    input,
  );
}
