import { AUDIT_SOURCES, type AuditSource } from "@/lib/security/constants";

export type AuditInput = {
  action: string;
  outcome: "success" | "failure";
  source: AuditSource;
  actor?: string | null;
  subject?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export type AuditRow = {
  createdAt: Date;
  action: string;
  outcome: "success" | "failure";
  source: AuditSource;
  actor: string | null;
  subject: string | null;
  metadata: Record<string, string | number | boolean | null>;
};

export function buildAuditData(input: AuditInput, now = new Date()): AuditRow {
  if (!(AUDIT_SOURCES as readonly string[]).includes(input.source)) {
    throw new Error("Invalid audit source");
  }
  if (input.outcome !== "success" && input.outcome !== "failure") {
    throw new Error("Invalid audit outcome");
  }
  if (!input.action.trim()) {
    throw new Error("Audit action is required");
  }
  return {
    createdAt: now,
    action: input.action,
    outcome: input.outcome,
    source: input.source,
    actor: input.actor ?? null,
    subject: input.subject ?? null,
    metadata: input.metadata ?? {},
  };
}

export async function persistAudit(
  create: (row: AuditRow) => Promise<unknown>,
  input: AuditInput,
  now = new Date(),
) {
  const row = buildAuditData(input, now);
  await create(row);
  return row;
}
