import "server-only";
import { getD1, getOptionalD1 } from "@/db";
import { decryptSecret, encryptSecret, hasEncryptionKey } from "@/lib/secrets";
import type { BlogPost } from "@/lib/posts";
import { deliverConnectorDelivery, dispatchConnectorEvent, toDistributionPost } from "@/lib/publishing-connectors";
import { assertPublicHttpsUrl } from "@/lib/connector-contract.mjs";

export type AiProvider = "openai" | "openrouter" | "anthropic" | "custom";
export type IntegrationSettings = {
  ai: {
    provider: AiProvider;
    model: string;
    baseUrl: string;
    audience: string;
    voice: string;
    guardrails: string;
    connected: boolean;
  };
  postiz: { webhookUrl: string; connected: boolean };
  wordpressSiteUrl: string;
  encryptionReady: boolean;
};

type AiRow = {
  provider: string; model: string; base_url: string; api_key_ciphertext: string;
  audience: string; voice: string; guardrails: string;
};
type IntegrationRow = {
  postiz_webhook_url: string; postiz_token_ciphertext: string; wordpress_site_url: string;
};

export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  const db = await getOptionalD1();
  const defaults: IntegrationSettings = {
    ai: {
      provider: "openai", model: "gpt-4.1-mini", baseUrl: "https://api.openai.com/v1",
      audience: "", voice: "Clear, useful, and direct.",
      guardrails: "Do not invent facts, guarantees, statistics, quotes, or customer claims.", connected: false,
    },
    postiz: { webhookUrl: "", connected: false },
    wordpressSiteUrl: "",
    encryptionReady: await hasEncryptionKey(),
  };
  if (!db) return defaults;
  try {
    const [ai, integrations] = await Promise.all([
      db.prepare(`SELECT provider, model, base_url, api_key_ciphertext, audience, voice, guardrails FROM ai_settings WHERE id = 1`).first<AiRow>(),
      db.prepare(`SELECT postiz_webhook_url, postiz_token_ciphertext, wordpress_site_url FROM integration_settings WHERE id = 1`).first<IntegrationRow>(),
    ]);
    return {
      ai: ai ? {
        provider: readProvider(ai.provider), model: ai.model, baseUrl: ai.base_url,
        audience: ai.audience, voice: ai.voice, guardrails: ai.guardrails,
        connected: Boolean(ai.api_key_ciphertext),
      } : defaults.ai,
      postiz: integrations ? {
        webhookUrl: integrations.postiz_webhook_url,
        connected: Boolean(integrations.postiz_webhook_url),
      } : defaults.postiz,
      wordpressSiteUrl: integrations?.wordpress_site_url || "",
      encryptionReady: defaults.encryptionReady,
    };
  } catch {
    return defaults;
  }
}

export async function updateIntegrationSettings(input: {
  ai?: Partial<IntegrationSettings["ai"]> & { apiKey?: unknown };
  postiz?: Partial<IntegrationSettings["postiz"]> & { token?: unknown };
  wordpressSiteUrl?: unknown;
}) {
  const current = await getIntegrationSettings();
  const provider = readProvider(String(input.ai?.provider || current.ai.provider));
  const model = readText(input.ai?.model, current.ai.model, 120);
  const baseUrl = readHttpsUrl(input.ai?.baseUrl, current.ai.baseUrl, "AI base URL");
  const audience = readText(input.ai?.audience, current.ai.audience, 1000);
  const voice = readText(input.ai?.voice, current.ai.voice, 2000);
  const guardrails = readText(input.ai?.guardrails, current.ai.guardrails, 4000);
  const webhookUrl = readOptionalHttpsUrl(input.postiz?.webhookUrl, current.postiz.webhookUrl, "Postiz webhook URL");
  const wordpressSiteUrl = readOptionalHttpsUrl(input.wordpressSiteUrl, current.wordpressSiteUrl, "WordPress site URL");
  const db = await getD1();
  const existingAi = await db.prepare(`SELECT api_key_ciphertext FROM ai_settings WHERE id = 1`).first<{ api_key_ciphertext: string }>();
  const existingPostiz = await db.prepare(`SELECT postiz_token_ciphertext FROM integration_settings WHERE id = 1`).first<{ postiz_token_ciphertext: string }>();
  const apiKey = typeof input.ai?.apiKey === "string" && input.ai.apiKey.trim()
    ? await encryptSecret(input.ai.apiKey.trim()) : existingAi?.api_key_ciphertext || "";
  const token = typeof input.postiz?.token === "string" && input.postiz.token.trim()
    ? await encryptSecret(input.postiz.token.trim()) : existingPostiz?.postiz_token_ciphertext || "";
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(
      `INSERT INTO ai_settings (id, provider, model, base_url, api_key_ciphertext, audience, voice, guardrails, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET provider=excluded.provider, model=excluded.model, base_url=excluded.base_url,
       api_key_ciphertext=excluded.api_key_ciphertext, audience=excluded.audience, voice=excluded.voice,
       guardrails=excluded.guardrails, updated_at=excluded.updated_at`,
    ).bind(provider, model, baseUrl, apiKey, audience, voice, guardrails, now),
    db.prepare(
      `INSERT INTO integration_settings (id, postiz_webhook_url, postiz_token_ciphertext, wordpress_site_url, updated_at)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET postiz_webhook_url=excluded.postiz_webhook_url,
       postiz_token_ciphertext=excluded.postiz_token_ciphertext, wordpress_site_url=excluded.wordpress_site_url,
       updated_at=excluded.updated_at`,
    ).bind(webhookUrl, token, wordpressSiteUrl, now),
  ]);
  return getIntegrationSettings();
}

export async function generateAiDraft(input: {
  brief: string; title?: string; purpose?: string; category?: string; targetLength?: number; actorEmail?: string;
}) {
  const db = await getD1();
  const row = await db.prepare(
    `SELECT provider, model, base_url, api_key_ciphertext, audience, voice, guardrails
     FROM ai_settings WHERE id = 1`,
  ).first<AiRow>();
  if (!row?.api_key_ciphertext) throw new Error("Connect an AI provider in Integrations first.");
  const apiKey = await decryptSecret(row.api_key_ciphertext);
  const targetLength = Math.min(Math.max(Number(input.targetLength) || 900, 300), 3000);
  const prompt = `Create a blog draft for human review. Return only valid JSON with keys title, slug, description, content, seoTitle, seoDescription, category.\n\nBrief: ${readText(input.brief, "", 4000)}\nExisting title: ${input.title || ""}\nPrivate direction: ${input.purpose || ""}\nCategory: ${input.category || "General"}\nAudience: ${row.audience}\nVoice: ${row.voice}\nGuardrails: ${row.guardrails}\nTarget length: about ${targetLength} words.\nUse Markdown headings and lists where useful. Never claim the draft is approved or published.`;
  const startedAt = Date.now();
  let text = "";
  try {
    text = row.provider === "anthropic"
      ? await callAnthropic(row.base_url, row.model, apiKey, prompt)
      : await callOpenAiCompatible(row.base_url, row.model, apiKey, prompt);
    await recordAiUsage(db, { actorEmail: input.actorEmail || "", provider: row.provider,
      model: row.model, status: "succeeded", durationMs: Date.now() - startedAt,
      inputCharacters: prompt.length, outputCharacters: text.length, errorMessage: "" });
  } catch (error) {
    await recordAiUsage(db, { actorEmail: input.actorEmail || "", provider: row.provider,
      model: row.model, status: "failed", durationMs: Date.now() - startedAt,
      inputCharacters: prompt.length, outputCharacters: 0,
      errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown error" });
    throw error;
  }
  const result = parseJsonObject(text);
  return {
    title: readText(result.title, input.title || "Untitled draft", 160),
    slug: slugify(readText(result.slug, result.title || input.title || "draft", 180)),
    description: readText(result.description, "", 320),
    content: readText(result.content, "", 60000),
    seoTitle: readText(result.seoTitle, result.title || input.title || "", 160),
    seoDescription: readText(result.seoDescription, result.description || "", 320),
    category: readText(result.category, input.category || "General", 80),
    status: "draft" as const,
  };
}

export async function testAiConnection(actorEmail: string) {
  const db = await getD1();
  const row = await db.prepare(`SELECT provider, model, base_url, api_key_ciphertext,
    audience, voice, guardrails FROM ai_settings WHERE id = 1`).first<AiRow>();
  if (!row?.api_key_ciphertext) throw new Error("Save an AI provider key first.");
  const apiKey = await decryptSecret(row.api_key_ciphertext);
  const prompt = "Return only a JSON object with an ok key set to true.";
  const startedAt = Date.now();
  try {
    const output = row.provider === "anthropic"
      ? await callAnthropic(row.base_url, row.model, apiKey, prompt)
      : await callOpenAiCompatible(row.base_url, row.model, apiKey, prompt);
    parseJsonObject(output);
    await recordAiUsage(db, { actorEmail, provider: row.provider, model: row.model,
      status: "connection_test_succeeded", durationMs: Date.now() - startedAt,
      inputCharacters: prompt.length, outputCharacters: output.length, errorMessage: "" });
    return true;
  } catch (error) {
    await recordAiUsage(db, { actorEmail, provider: row.provider, model: row.model,
      status: "connection_test_failed", durationMs: Date.now() - startedAt,
      inputCharacters: prompt.length, outputCharacters: 0,
      errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown error" });
    throw error;
  }
}

export async function dispatchPostizEvent(post: BlogPost, event: "saved" | "scheduled" | "published") {
  if (post.approvalStatus !== "approved") return;
  const db = await getOptionalD1();
  if (!db) return;
  const row = await db.prepare(
    `SELECT postiz_webhook_url, postiz_token_ciphertext FROM integration_settings WHERE id = 1`,
  ).first<{ postiz_webhook_url: string; postiz_token_ciphertext: string }>();
  if (!row?.postiz_webhook_url) return;
  const now = new Date().toISOString();
  const idempotencyKey = `postiz:${event}:${post.id}:v${post.version}`;
  const payload = JSON.stringify({ source: "white-hat-cms-lite", event, post: toDistributionPost(post), sentAt: now });
  await db.prepare(
    `INSERT INTO integration_deliveries
     (provider, event_type, post_id, idempotency_key, payload_json, status, next_attempt_at, updated_at)
     VALUES ('postiz', ?, ?, ?, ?, 'pending', ?, ?)
     ON CONFLICT(idempotency_key) DO NOTHING`,
  ).bind(event, post.id, idempotencyKey, payload, now, now).run();
  const delivery = await db.prepare(
    `SELECT id, status FROM integration_deliveries WHERE idempotency_key = ?`,
  ).bind(idempotencyKey).first<{ id: number; status: string }>();
  if (delivery && delivery.status !== "succeeded") await deliverPostiz(delivery.id);
}

export async function dispatchDistributionEvent(post: BlogPost, event: "scheduled" | "published") {
  if (post.approvalStatus !== "approved") return;
  const results = await Promise.allSettled([
    dispatchPostizEvent(post, event),
    dispatchConnectorEvent(post, event),
  ]);
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failures.length) {
    throw new Error(failures.map((failure) => failure.reason instanceof Error ? failure.reason.message : "Distribution failed.").join(" ").slice(0, 500));
  }
}

export async function listIntegrationDeliveries(limit = 50) {
  const db = await getD1();
  const result = await db.prepare(
    `SELECT id, provider, connector_id, event_type, post_id, status, attempts, last_error,
            next_attempt_at, external_id, external_url, created_at, updated_at
     FROM integration_deliveries ORDER BY id DESC LIMIT ?`,
  ).bind(Math.min(Math.max(limit, 1), 100)).all();
  return result.results;
}

export async function retryIntegrationDelivery(id: number) {
  const db = await getD1();
  const delivery = await db.prepare(`SELECT provider, connector_id FROM integration_deliveries WHERE id = ?`)
    .bind(id).first<{ provider: string; connector_id: number | null }>();
  if (!delivery) throw new Error("Delivery not found.");
  await db.prepare(`UPDATE integration_deliveries SET status = 'pending', next_attempt_at = ?, updated_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), new Date().toISOString(), id).run();
  return delivery.provider === "postiz" && delivery.connector_id === null
    ? deliverPostiz(id)
    : deliverConnectorDelivery(id);
}

async function deliverPostiz(id: number) {
  const db = await getD1();
  const [delivery, settings] = await Promise.all([
    db.prepare(`SELECT id, payload_json, attempts FROM integration_deliveries WHERE id = ? AND provider = 'postiz'`).bind(id)
      .first<{ id: number; payload_json: string; attempts: number }>(),
    db.prepare(`SELECT postiz_webhook_url, postiz_token_ciphertext FROM integration_settings WHERE id = 1`)
      .first<{ postiz_webhook_url: string; postiz_token_ciphertext: string }>(),
  ]);
  if (!delivery || !settings?.postiz_webhook_url) return false;
  const token = settings.postiz_token_ciphertext ? await decryptSecret(settings.postiz_token_ciphertext) : "";
  try {
    const webhookUrl = assertPublicHttpsUrl(settings.postiz_webhook_url, "Postiz webhook URL");
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": `delivery-${id}`,
        ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: delivery.payload_json,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Postiz webhook returned ${response.status}.`);
    await db.prepare(`UPDATE integration_deliveries SET status = 'succeeded', attempts = attempts + 1,
      last_error = '', updated_at = ? WHERE id = ?`).bind(new Date().toISOString(), id).run();
    return true;
  } catch (error) {
    const attempts = delivery.attempts + 1;
    const delayMinutes = Math.min(60, 2 ** Math.min(attempts, 5));
    const next = new Date(Date.now() + delayMinutes * 60000).toISOString();
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
    await db.prepare(`UPDATE integration_deliveries SET status = 'failed', attempts = ?,
      last_error = ?, next_attempt_at = ?, updated_at = ? WHERE id = ?`)
      .bind(attempts, message, next, new Date().toISOString(), id).run();
    throw new Error(message);
  }
}

async function callOpenAiCompatible(baseUrl: string, model: string, apiKey: string, prompt: string) {
  const endpoint = assertPublicHttpsUrl(`${baseUrl.replace(/\/$/, "")}/chat/completions`, "AI request URL");
  const requestBody = { model, temperature: 0.5, response_format: { type: "json_object" }, messages: [
    { role: "system", content: "You are a careful editorial drafting assistant. Draft only. Human review is mandatory." },
    { role: "user", content: prompt },
  ] };
  let response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(requestBody),
    redirect: "error",
    signal: AbortSignal.timeout(45000),
  });
  if (response.status === 400) {
    const fallbackBody: Omit<typeof requestBody, "response_format"> = {
      model: requestBody.model, temperature: requestBody.temperature, messages: requestBody.messages,
    };
    response = await fetch(endpoint, { method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(fallbackBody), redirect: "error", signal: AbortSignal.timeout(45000) });
  }
  if (!response.ok) throw new Error(`AI provider returned ${response.status}.`);
  const data = JSON.parse(await readLimitedResponseText(response, 5 * 1024 * 1024)) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content || "";
}

async function callAnthropic(baseUrl: string, model: string, apiKey: string, prompt: string) {
  const endpoint = assertPublicHttpsUrl(`${baseUrl.replace(/\/$/, "")}/messages`, "AI request URL");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 5000, system: "You are a careful editorial drafting assistant. Draft only. Human review is mandatory.", messages: [{ role: "user", content: prompt }] }), redirect: "error",
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`AI provider returned ${response.status}.`);
  const data = JSON.parse(await readLimitedResponseText(response, 5 * 1024 * 1024)) as { content?: Array<{ text?: string }> };
  return data.content?.map((item) => item.text || "").join("\n") || "";
}

function parseJsonObject(value: string): Record<string, unknown> {
  const cleaned = value.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The AI response was not valid structured content.");
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}
function readProvider(value: string): AiProvider { return ["openai", "openrouter", "anthropic", "custom"].includes(value) ? value as AiProvider : "openai"; }
function readText(value: unknown, fallback: string, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : fallback; }
function readHttpsUrl(value: unknown, fallback: string, label: string) { return assertPublicHttpsUrl(readText(value, fallback, 500), label); }
function readOptionalHttpsUrl(value: unknown, fallback: string, label: string) { const output = readText(value, fallback, 500); return output ? readHttpsUrl(output, "", label) : ""; }
function slugify(value: string) { return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180); }

async function readLimitedResponseText(response: Response, limit: number) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > limit) throw new Error("Provider response was too large.");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error("Provider response was too large."); }
    chunks.push(value);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(output);
}

async function recordAiUsage(db: Awaited<ReturnType<typeof getD1>>, input: {
  actorEmail: string; provider: string; model: string; status: string;
  durationMs: number; inputCharacters: number; outputCharacters: number; errorMessage: string;
}) {
  await db.prepare(`INSERT INTO ai_usage (actor_email, provider, model, status,
    duration_ms, input_characters, output_characters, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(input.actorEmail, input.provider, input.model, input.status, input.durationMs,
      input.inputCharacters, input.outputCharacters, input.errorMessage).run();
}
