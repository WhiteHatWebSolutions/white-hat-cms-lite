import "server-only";
import { getD1 } from "@/db";

export async function recordAuditEvent(input: {
  actorEmail: string;
  action: string;
  entityType: string;
  entityId?: string | number;
  details?: Record<string, unknown>;
}) {
  const db = await getD1();
  await db
    .prepare(
      `INSERT INTO audit_events
       (actor_email, action, entity_type, entity_id, details_json)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      input.actorEmail,
      input.action,
      input.entityType,
      String(input.entityId ?? ""),
      JSON.stringify(input.details ?? {}),
    )
    .run();
}

export async function listAuditEvents(limit = 100) {
  const db = await getD1();
  const result = await db
    .prepare(
      `SELECT id, actor_email, action, entity_type, entity_id, details_json, created_at
       FROM audit_events ORDER BY id DESC LIMIT ?`,
    )
    .bind(Math.min(Math.max(limit, 1), 250))
    .all();
  return result.results;
}
