import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function migratedDatabase() {
  const database = new DatabaseSync(":memory:");
  const directory = join(process.cwd(), "drizzle");
  const files = readdirSync(directory).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
  for (const file of files) {
    const sql = readFileSync(join(directory, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) database.exec(statement);
  }
  return database;
}

function insertPost(database, overrides = {}) {
  const post = { slug: crypto.randomUUID(), title: "Test post", description: "Complete excerpt",
    content: "Complete body", status: "scheduled", publishDate: "2026-08-18",
    publishTime: "09:00", approval: "approved", deletedAt: null, version: 1, ...overrides };
  return database.prepare(`INSERT INTO blog_posts
    (slug, title, description, content, status, publish_date, publish_time,
     approval_status, deleted_at, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(post.slug, post.title,
      post.description, post.content, post.status, post.publishDate, post.publishTime,
      post.approval, post.deletedAt, post.version).lastInsertRowid;
}

test("all migrations apply cleanly to an empty SQLite database", () => {
  const database = migratedDatabase();
  const tables = database.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all().map((row) => row.name);
  for (const table of ["blog_posts", "site_settings", "cms_users", "post_revisions",
    "post_comments", "audit_events", "media_assets", "ai_settings",
    "integration_settings", "integration_deliveries", "ai_usage", "rate_limits"]) {
    assert.ok(tables.includes(table), `${table} is missing`);
  }
  assert.ok(tables.includes("publishing_connectors"), "publishing_connectors is missing");
});

test("scheduled publication requires approval, exact time, complete content, and active record", () => {
  const database = migratedDatabase();
  const due = insertPost(database, { publishTime: "08:59" });
  insertPost(database, { publishTime: "09:01" });
  insertPost(database, { approval: "review", publishTime: "08:00" });
  insertPost(database, { deletedAt: "2026-08-18T00:00:00Z", publishTime: "08:00" });
  insertPost(database, { content: "", publishTime: "08:00" });
  const rows = database.prepare(`SELECT id FROM blog_posts
    WHERE status IN ('scheduled', 'published') AND approval_status = 'approved'
      AND deleted_at IS NULL
      AND (publish_date < ? OR (publish_date = ? AND publish_time <= ?))
      AND TRIM(description) <> '' AND TRIM(content) <> ''`).all("2026-08-18", "2026-08-18", "09:00");
  assert.deepEqual(rows.map((row) => Number(row.id)), [Number(due)]);
});

test("optimistic locking rejects a stale post version", () => {
  const database = migratedDatabase();
  const id = insertPost(database);
  const first = database.prepare(`UPDATE blog_posts SET title = ?, version = version + 1 WHERE id = ? AND version = ?`).run("First", id, 1);
  const stale = database.prepare(`UPDATE blog_posts SET title = ?, version = version + 1 WHERE id = ? AND version = ?`).run("Stale", id, 1);
  assert.equal(first.changes, 1);
  assert.equal(stale.changes, 0);
  assert.equal(database.prepare(`SELECT title FROM blog_posts WHERE id = ?`).get(id).title, "First");
});

test("delivery idempotency keys prevent duplicate distribution jobs", () => {
  const database = migratedDatabase();
  const statement = database.prepare(`INSERT INTO integration_deliveries
    (provider, event_type, post_id, idempotency_key, payload_json, next_attempt_at)
    VALUES ('postiz', 'scheduled', 1, ?, '{}', '2026-08-18T00:00:00Z')`);
  statement.run("postiz:scheduled:1:v1");
  assert.throws(() => statement.run("postiz:scheduled:1:v1"), /UNIQUE/);
});

test("publishing connectors default to draft delivery and encrypted credential storage", () => {
  const database = migratedDatabase();
  const id = database.prepare(`INSERT INTO publishing_connectors
    (provider, name, config_json, secret_ciphertext) VALUES (?, ?, ?, ?)`)
    .run("ghost", "Editorial Ghost", '{"baseUrl":"https://ghost.example.com"}', "encrypted.value").lastInsertRowid;
  const row = database.prepare(`SELECT delivery_mode, enabled, secret_ciphertext FROM publishing_connectors WHERE id = ?`).get(id);
  assert.deepEqual({ ...row }, { delivery_mode: "draft", enabled: 1, secret_ciphertext: "encrypted.value" });
});

test("rate-limit increments use one atomic upsert", () => {
  const database = migratedDatabase();
  const statement = database.prepare(`INSERT INTO rate_limits (bucket, count, reset_at)
    VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET
      count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
      reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END
    RETURNING count, reset_at`);
  const reset = "2026-08-18T12:01:00.000Z";
  assert.equal(statement.get("ai:user", reset, "2026-08-18T12:00:00.000Z", "2026-08-18T12:00:00.000Z").count, 1);
  assert.equal(statement.get("ai:user", reset, "2026-08-18T12:00:01.000Z", "2026-08-18T12:00:01.000Z").count, 2);
  assert.equal(statement.get("ai:user", "2026-08-18T12:02:00.000Z", "2026-08-18T12:01:01.000Z", "2026-08-18T12:01:01.000Z").count, 1);
});

test("restore policy resets publication and approval states", () => {
  const database = migratedDatabase();
  const id = insertPost(database, { deletedAt: "2026-08-18T00:00:00Z" });
  database.prepare(`UPDATE blog_posts SET deleted_at = NULL, status = 'draft',
    approval_status = 'draft', approved_by = '', approved_at = NULL,
    version = version + 1 WHERE id = ? AND deleted_at IS NOT NULL`).run(id);
  const row = database.prepare(`SELECT status, approval_status, deleted_at, version FROM blog_posts WHERE id = ?`).get(id);
  assert.deepEqual({ ...row }, { status: "draft", approval_status: "draft", deleted_at: null, version: 2 });
});
