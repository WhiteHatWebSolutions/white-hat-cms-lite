import "server-only";
import { getD1, getOptionalD1 } from "@/db";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import type { BlogPost } from "@/lib/posts";
import {
  CONNECTOR_PROVIDERS,
  assertPublicHttpsUrl,
  buildConnectionTestRequest,
  buildConnectorRequest,
  normalizeConnectorInput,
  type ConnectorConfig,
  type ConnectorProvider,
  type ConnectorRequest,
} from "@/lib/connector-contract.mjs";

export type PublishingConnector = {
  id: number;
  provider: ConnectorProvider;
  name: string;
  config: ConnectorConfig;
  enabled: boolean;
  deliveryMode: "draft" | "publish";
  connected: boolean;
  createdAt: string;
  updatedAt: string;
};

type ConnectorRow = {
  id: number; provider: string; name: string; config_json: string; secret_ciphertext: string;
  enabled: number; delivery_mode: string; created_at: string; updated_at: string;
};

type DeliveryRow = { id: number; connector_id: number; payload_json: string; attempts: number };
type DistributionPost = Pick<BlogPost, "id" | "slug" | "title" | "description" | "content" | "category" |
  "status" | "publishDate" | "publishTime" | "featured" | "seoTitle" | "seoDescription" |
  "approvalStatus" | "version" | "updatedAt">;

const connectorSelect = `SELECT id, provider, name, config_json, secret_ciphertext, enabled,
  delivery_mode, created_at, updated_at FROM publishing_connectors`;

export { CONNECTOR_PROVIDERS };

export async function listPublishingConnectors(): Promise<PublishingConnector[]> {
  const db = await getOptionalD1();
  if (!db) return [];
  try {
    const rows = (await db.prepare(`${connectorSelect} ORDER BY name ASC, id ASC`).all<ConnectorRow>()).results;
    return rows.map(publicConnector);
  } catch {
    return [];
  }
}

export async function createPublishingConnector(input: Record<string, unknown>) {
  const normalized = normalizeConnectorInput(input);
  const secret = readSecret(input.secret);
  if (!secret) throw new Error(`${CONNECTOR_PROVIDERS[normalized.provider].secretLabel} is required.`);
  const db = await getD1();
  const now = new Date().toISOString();
  const result = await db.prepare(`INSERT INTO publishing_connectors
    (provider, name, config_json, secret_ciphertext, enabled, delivery_mode, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(normalized.provider, normalized.name,
      JSON.stringify(normalized.config), await encryptSecret(secret), normalized.enabled ? 1 : 0,
      normalized.deliveryMode, now).run();
  return getPublishingConnector(Number(result.meta.last_row_id));
}

export async function updatePublishingConnector(id: number, input: Record<string, unknown>) {
  const row = await getConnectorRow(id);
  if (!row) throw new Error("Connector not found.");
  const current = publicConnector(row);
  const normalized = normalizeConnectorInput(input, current);
  if (normalized.provider !== current.provider) throw new Error("Create a new connector to change platforms.");
  const suppliedSecret = readSecret(input.secret);
  const ciphertext = suppliedSecret ? await encryptSecret(suppliedSecret) : row.secret_ciphertext;
  if (!ciphertext) throw new Error(`${CONNECTOR_PROVIDERS[normalized.provider].secretLabel} is required.`);
  const db = await getD1();
  await db.prepare(`UPDATE publishing_connectors SET name = ?, config_json = ?, secret_ciphertext = ?,
    enabled = ?, delivery_mode = ?, updated_at = ? WHERE id = ?`).bind(normalized.name,
      JSON.stringify(normalized.config), ciphertext, normalized.enabled ? 1 : 0,
      normalized.deliveryMode, new Date().toISOString(), id).run();
  return getPublishingConnector(id);
}

export async function deletePublishingConnector(id: number) {
  const db = await getD1();
  const result = await db.prepare(`DELETE FROM publishing_connectors WHERE id = ?`).bind(id).run();
  return result.meta.changes > 0;
}

export async function testPublishingConnector(id: number) {
  const row = await getConnectorRow(id);
  if (!row) throw new Error("Connector not found.");
  const connector = validatedConnector(row);
  const secret = await connectorSecret(row);
  const credential = connector.provider === "ghost" ? await createGhostAdminToken(secret) : secret;
  const outgoing = buildConnectionTestRequest(connector.provider, connector.config, credential);
  await prepareSignedWebhook(outgoing, connector.provider, secret);
  await performRequest(outgoing);
  return true;
}

export async function dispatchConnectorEvent(post: BlogPost, event: "scheduled" | "published") {
  if (post.approvalStatus !== "approved") return;
  const db = await getOptionalD1();
  if (!db) return;
  let rows: ConnectorRow[];
  try {
    rows = (await db.prepare(`${connectorSelect} WHERE enabled = 1 ORDER BY id ASC`).all<ConnectorRow>()).results;
  } catch {
    return;
  }
  const failures: string[] = [];
  for (const row of rows) {
    try {
      const connector = validatedConnector(row);
      const now = new Date().toISOString();
      const idempotencyKey = `connector:${connector.id}:${event}:${post.id}:v${post.version}`;
      const payload = JSON.stringify({ event, post: toDistributionPost(post) });
      await db.prepare(`INSERT INTO integration_deliveries
        (provider, connector_id, event_type, post_id, idempotency_key, payload_json, status, next_attempt_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?) ON CONFLICT(idempotency_key) DO NOTHING`)
        .bind(connector.provider, connector.id, event, post.id, idempotencyKey, payload, now, now).run();
      const delivery = await db.prepare(`SELECT id, status FROM integration_deliveries WHERE idempotency_key = ?`)
        .bind(idempotencyKey).first<{ id: number; status: string }>();
      if (delivery && delivery.status !== "succeeded") await deliverConnectorDelivery(delivery.id);
    } catch (error) {
      failures.push(`${row.name}: ${error instanceof Error ? error.message : "delivery failed"}`);
    }
  }
  if (failures.length) throw new Error(failures.join(" ").slice(0, 500));
}

export async function deliverConnectorDelivery(id: number) {
  const db = await getD1();
  const delivery = await db.prepare(`SELECT id, connector_id, payload_json, attempts
    FROM integration_deliveries WHERE id = ? AND connector_id IS NOT NULL`).bind(id).first<DeliveryRow>();
  if (!delivery) throw new Error("Connector delivery not found.");
  const row = await getConnectorRow(delivery.connector_id);
  if (!row) throw new Error("The connector used by this delivery no longer exists.");
  const connector = validatedConnector(row);
  const payload = JSON.parse(delivery.payload_json) as { event?: string; post?: DistributionPost };
  if (!payload.post || !["scheduled", "published"].includes(payload.event || "") || payload.post.approvalStatus !== "approved") {
    throw new Error("The delivery payload did not pass the approval gate.");
  }
  const secret = await connectorSecret(row);
  const credential = connector.provider === "ghost" ? await createGhostAdminToken(secret) : secret;
  const outgoing = buildConnectorRequest(connector.provider, connector.config, credential, payload.post,
    payload.event as "scheduled" | "published", connector.deliveryMode);
  await prepareSignedWebhook(outgoing, connector.provider, secret);
  try {
    const result = await performRequest(outgoing);
    const external = await finishAndParse(connector, outgoing, result, credential);
    await db.prepare(`UPDATE integration_deliveries SET status = 'succeeded', attempts = attempts + 1,
      last_error = '', external_id = ?, external_url = ?, updated_at = ? WHERE id = ?`)
      .bind(external.id, external.url, new Date().toISOString(), id).run();
    return true;
  } catch (error) {
    const attempts = delivery.attempts + 1;
    const next = new Date(Date.now() + Math.min(60, 2 ** Math.min(attempts, 5)) * 60000).toISOString();
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown connector error";
    await db.prepare(`UPDATE integration_deliveries SET status = 'failed', attempts = ?, last_error = ?,
      next_attempt_at = ?, updated_at = ? WHERE id = ?`).bind(attempts, message, next, new Date().toISOString(), id).run();
    throw new Error(message);
  }
}

async function finishAndParse(connector: PublishingConnector, outgoing: ConnectorRequest, result: unknown, credential: string) {
  const data = objectValue(result);
  if (connector.provider === "contentful" && outgoing.publish) {
    const sys = objectValue(data.sys);
    const entryId = String(sys.id || outgoing.entryId || "");
    const version = Number(sys.version);
    if (!entryId || !Number.isFinite(version)) throw new Error("Contentful did not return the created entry version.");
    await performRequest({ url: `${outgoing.url}/published`, method: "PUT", headers: {
      accept: "application/json", authorization: `Bearer ${credential}`, "x-contentful-version": String(version),
    } });
    return { id: entryId, url: "" };
  }
  if (connector.provider === "shopify") {
    const errors = Array.isArray(data.errors) ? data.errors : [];
    const articleCreate = objectValue(objectValue(data.data).articleCreate);
    const userErrors = Array.isArray(articleCreate.userErrors) ? articleCreate.userErrors : [];
    if (errors.length || userErrors.length) throw new Error("Shopify rejected the article payload.");
    const article = objectValue(articleCreate.article);
    return { id: String(article.id || ""), url: "" };
  }
  if (connector.provider === "ghost") { const item = Array.isArray(data.posts) ? objectValue(data.posts[0]) : {}; return { id: String(item.id || ""), url: safeExternalUrl(item.url) }; }
  if (connector.provider === "webflow") return { id: String(data.id || ""), url: "" };
  if (connector.provider === "sanity") { const item = Array.isArray(data.results) ? objectValue(data.results[0]) : {}; return { id: String(item.id || outgoing.entryId || ""), url: "" }; }
  if (connector.provider === "strapi") { const item = objectValue(data.data); return { id: String(item.documentId || item.id || ""), url: "" }; }
  if (connector.provider === "hubspot") return { id: String(data.id || ""), url: safeExternalUrl(data.url) };
  if (connector.provider === "drupal") { const item = objectValue(data.data); const links = objectValue(item.links); const self = objectValue(links.self); return { id: String(item.id || ""), url: safeExternalUrl(self.href) }; }
  return { id: "", url: "" };
}

async function getPublishingConnector(id: number) {
  const row = await getConnectorRow(id);
  if (!row) throw new Error("Connector not found.");
  return publicConnector(row);
}

async function getConnectorRow(id: number) {
  const db = await getD1();
  return db.prepare(`${connectorSelect} WHERE id = ?`).bind(id).first<ConnectorRow>();
}

function publicConnector(row: ConnectorRow): PublishingConnector {
  const config = parseConfig(row.config_json);
  return { id: Number(row.id), provider: row.provider as ConnectorProvider, name: row.name, config,
    enabled: Boolean(row.enabled), deliveryMode: row.delivery_mode === "publish" ? "publish" : "draft",
    connected: Boolean(row.secret_ciphertext), createdAt: row.created_at, updatedAt: row.updated_at };
}

function validatedConnector(row: ConnectorRow) {
  const connector = publicConnector(row);
  const normalized = normalizeConnectorInput(connector);
  return { ...connector, ...normalized };
}

async function connectorSecret(row: ConnectorRow) {
  if (!row.secret_ciphertext) throw new Error("Save the connector credential first.");
  return decryptSecret(row.secret_ciphertext);
}

async function performRequest(outgoing: ConnectorRequest) {
  assertPublicHttpsUrl(outgoing.url, "Connector request URL");
  const response = await fetch(outgoing.url, { method: outgoing.method, headers: outgoing.headers,
    ...(outgoing.body ? { body: outgoing.body } : {}), redirect: "error", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Connector returned HTTP ${response.status}.`);
  if (response.status === 204) return {};
  const text = await readLimitedResponseText(response, 1024 * 1024);
  if (!text.trim()) return {};
  try { return JSON.parse(text) as unknown; } catch { return {}; }
}

async function prepareSignedWebhook(outgoing: ConnectorRequest, provider: ConnectorProvider, secret: string) {
  if (provider !== "webhook" || !outgoing.body) return;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const data = new TextEncoder().encode(`${timestamp}.${outgoing.body}`);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  outgoing.headers["x-white-hat-cms-timestamp"] = timestamp;
  outgoing.headers["x-white-hat-cms-signature"] = `sha256=${bytesToHex(new Uint8Array(signature))}`;
}

async function createGhostAdminToken(apiKey: string) {
  const [id, secret] = apiKey.split(":");
  if (!id || !secret || !/^[a-f0-9]+$/i.test(secret) || secret.length % 2) throw new Error("Ghost Admin API key format is invalid.");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT", kid: id })));
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({ iat: now, exp: now + 300, aud: "/admin/" })));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("raw", hexToBytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

function parseConfig(value: string): ConnectorConfig {
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" ? parsed as ConnectorConfig : {}; } catch { return {}; }
}
function readSecret(value: unknown) { return typeof value === "string" ? value.trim().slice(0, 4000) : ""; }
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function safeExternalUrl(value: unknown) { if (typeof value !== "string") return ""; try { return assertPublicHttpsUrl(value, "External URL"); } catch { return ""; } }
function hexToBytes(value: string) { const bytes = new Uint8Array(value.length / 2); for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16); return bytes; }
function base64Url(bytes: Uint8Array) { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
function bytesToHex(bytes: Uint8Array) { return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join(""); }

export function toDistributionPost(post: BlogPost): DistributionPost {
  return { id: post.id, slug: post.slug, title: post.title, description: post.description,
    content: post.content, category: post.category, status: post.status,
    publishDate: post.publishDate, publishTime: post.publishTime, featured: post.featured,
    seoTitle: post.seoTitle, seoDescription: post.seoDescription,
    approvalStatus: post.approvalStatus, version: post.version, updatedAt: post.updatedAt };
}

async function readLimitedResponseText(response: Response, limit: number) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > limit) throw new Error("Connector response was too large.");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error("Connector response was too large."); }
    chunks.push(value);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(output);
}
