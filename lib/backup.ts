import "server-only";
import { getD1 } from "@/db";

export const BACKUP_TABLES = [
  "blog_posts", "site_settings", "cms_users", "post_revisions", "post_comments",
  "audit_events", "media_assets", "ai_settings", "integration_settings",
  "publishing_connectors", "integration_deliveries", "ai_usage",
] as const;

export type BackupDocument = {
  format: "white-hat-cms-lite-backup";
  schemaVersion: 1 | 2;
  product: "White Hat CMS Lite";
  exportedAt: string;
  checksum: string;
  data: Record<string, Array<Record<string, unknown>>>;
};

export async function createBackup(): Promise<BackupDocument> {
  const db = await getD1();
  const data: BackupDocument["data"] = {};
  for (const table of BACKUP_TABLES) {
    data[table] = (await db.prepare(`SELECT * FROM ${table}`).all()).results as Array<Record<string, unknown>>;
  }
  data.ai_settings = data.ai_settings.map((row) => ({ ...row, api_key_ciphertext: "[REDACTED]" }));
  data.integration_settings = data.integration_settings.map((row) => ({ ...row, postiz_token_ciphertext: "[REDACTED]" }));
  data.publishing_connectors = data.publishing_connectors.map((row) => ({ ...row, secret_ciphertext: "[REDACTED]" }));
  return { format: "white-hat-cms-lite-backup", schemaVersion: 2,
    product: "White Hat CMS Lite", exportedAt: new Date().toISOString(),
    checksum: await checksumData(data), data };
}

export async function restoreBackup(document: BackupDocument) {
  validateBackupShape(document);
  if (await checksumData(document.data) !== document.checksum) throw new Error("The backup checksum does not match its contents.");
  const db = await getD1();
  const existingAi = await db.prepare(`SELECT api_key_ciphertext FROM ai_settings WHERE id = 1`).first<{ api_key_ciphertext: string }>();
  const existingPostiz = await db.prepare(`SELECT postiz_token_ciphertext FROM integration_settings WHERE id = 1`).first<{ postiz_token_ciphertext: string }>();
  const existingConnectors = (await db.prepare(`SELECT id, secret_ciphertext FROM publishing_connectors`).all<{ id: number; secret_ciphertext: string }>()).results;
  const connectorSecrets = new Map(existingConnectors.map((row) => [Number(row.id), row.secret_ciphertext]));
  const statements: D1PreparedStatement[] = [];
  for (const table of [...BACKUP_TABLES].reverse()) statements.push(db.prepare(`DELETE FROM ${table}`));
  for (const table of BACKUP_TABLES) {
    const rows = document.data[table] || [];
    for (const original of rows) {
      const row = { ...original };
      if (table === "ai_settings" && row.api_key_ciphertext === "[REDACTED]") row.api_key_ciphertext = existingAi?.api_key_ciphertext || "";
      if (table === "integration_settings" && row.postiz_token_ciphertext === "[REDACTED]") row.postiz_token_ciphertext = existingPostiz?.postiz_token_ciphertext || "";
      if (table === "publishing_connectors" && row.secret_ciphertext === "[REDACTED]") row.secret_ciphertext = connectorSecrets.get(Number(row.id)) || "";
      const columns = Object.keys(row);
      if (!columns.length || columns.some((column) => !/^[a-z_]+$/.test(column))) throw new Error("The backup contains an invalid column name.");
      statements.push(db.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`).bind(...columns.map((column) => row[column] ?? null)));
    }
  }
  await db.batch(statements);
}

export async function checksumData(data: BackupDocument["data"]) {
  const bytes = new TextEncoder().encode(stableStringify(data));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validateBackupShape(document: BackupDocument) {
  if (document?.format !== "white-hat-cms-lite-backup" || ![1, 2].includes(document.schemaVersion) || !document.data || typeof document.checksum !== "string") {
    throw new Error("Choose a valid White Hat CMS Lite backup.");
  }
  for (const table of BACKUP_TABLES) {
    if (document.schemaVersion === 1 && table === "publishing_connectors") continue;
    if (!Array.isArray(document.data[table])) throw new Error(`The backup is missing ${table}.`);
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
