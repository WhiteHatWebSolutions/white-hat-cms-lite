"use client";

import { useState, type FormEvent } from "react";
import type { AiProvider, IntegrationSettings } from "@/lib/integrations";

export function IntegrationSettingsForm({ initialSettings }: { initialSettings: IntegrationSettings }) {
  const [values, setValues] = useState({
    provider: initialSettings.ai.provider,
    model: initialSettings.ai.model,
    baseUrl: initialSettings.ai.baseUrl,
    apiKey: "",
    audience: initialSettings.ai.audience,
    voice: initialSettings.ai.voice,
    guardrails: initialSettings.ai.guardrails,
    postizWebhookUrl: initialSettings.postiz.webhookUrl,
    postizToken: "",
    wordpressSiteUrl: initialSettings.wordpressSiteUrl,
  });
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("Saving...");
    const response = await fetch("/api/admin/integrations", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ai: { provider: values.provider, model: values.model, baseUrl: values.baseUrl, apiKey: values.apiKey, audience: values.audience, voice: values.voice, guardrails: values.guardrails },
        postiz: { webhookUrl: values.postizWebhookUrl, token: values.postizToken },
        wordpressSiteUrl: values.wordpressSiteUrl,
      }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setMessage(result.error || "Settings could not be saved."); return; }
    setValues((current) => ({ ...current, apiKey: "", postizToken: "" }));
    setMessage("Connections saved.");
  }

  function update(key: keyof typeof values, value: string) { setValues((current) => ({ ...current, [key]: value })); setMessage(""); }

  async function testAi() {
    setMessage("Testing saved AI connection...");
    const response = await fetch("/api/admin/integrations/test-ai", { method: "POST" });
    const result = await response.json() as { error?: string };
    setMessage(response.ok ? "AI connection succeeded." : result.error || "AI connection failed.");
  }

  return (
    <form className="settings-stack" onSubmit={save}>
      {!initialSettings.encryptionReady && <div className="notice notice-warning"><strong>Credential encryption is not configured.</strong><span>Add CMS_ENCRYPTION_KEY to the server environment before saving API keys.</span></div>}
      <section className="admin-panel">
        <div className="admin-section-heading"><div><p className="admin-kicker">Bring your own AI</p><h2>Writing assistant</h2></div><span className={`connection-status ${initialSettings.ai.connected ? "is-connected" : ""}`}>{initialSettings.ai.connected ? "Connected" : "Not connected"}</span></div>
        <div className="settings-grid-3">
          <label>Provider<select value={values.provider} onChange={(e) => update("provider", e.target.value as AiProvider)}><option value="openai">OpenAI</option><option value="openrouter">OpenRouter</option><option value="anthropic">Anthropic</option><option value="custom">OpenAI-compatible</option></select></label>
          <label>Model<input value={values.model} onChange={(e) => update("model", e.target.value)} required /></label>
          <label>API base URL<input type="url" value={values.baseUrl} onChange={(e) => update("baseUrl", e.target.value)} required /></label>
        </div>
        <label>API key<input type="password" autoComplete="new-password" value={values.apiKey} onChange={(e) => update("apiKey", e.target.value)} placeholder={initialSettings.ai.connected ? "Leave blank to keep saved key" : "Paste provider API key"} /></label>
        <div className="settings-grid-2">
          <label>Audience<textarea rows={4} value={values.audience} onChange={(e) => update("audience", e.target.value)} /></label>
          <label>Voice and style<textarea rows={4} value={values.voice} onChange={(e) => update("voice", e.target.value)} /></label>
        </div>
        <label>Content guardrails<textarea rows={5} value={values.guardrails} onChange={(e) => update("guardrails", e.target.value)} /></label>
        <div className="inline-actions"><small>AI output always enters the editor as an unapproved draft. A person must review it before publication.</small><button className="btn btn-secondary" type="button" onClick={() => void testAi()}>Test saved connection</button></div>
      </section>
      <section className="admin-panel">
        <div className="admin-section-heading"><div><p className="admin-kicker">Distribution</p><h2>Postiz webhook</h2></div><span className={`connection-status ${initialSettings.postiz.connected ? "is-connected" : ""}`}>{initialSettings.postiz.connected ? "Connected" : "Optional"}</span></div>
        <label>Webhook URL<input type="url" value={values.postizWebhookUrl} onChange={(e) => update("postizWebhookUrl", e.target.value)} placeholder="https://socials.example.com/..." /></label>
        <label>Webhook token<input type="password" autoComplete="new-password" value={values.postizToken} onChange={(e) => update("postizToken", e.target.value)} placeholder="Optional bearer token" /></label>
        <small>Approved scheduled and published post events are sent to Postiz. Use a signed automation webhook below for Zapier, Make, n8n, Pipedream, or custom workflows.</small>
      </section>
      <section className="admin-panel">
        <p className="admin-kicker">WordPress</p><h2>Connection target</h2>
        <label>WordPress site URL<input type="url" value={values.wordpressSiteUrl} onChange={(e) => update("wordpressSiteUrl", e.target.value)} placeholder="https://example.com" /></label>
        <div className="inline-actions"><a className="btn btn-secondary" href="/api/admin/export/wordpress">Download WordPress export</a><a className="admin-text-link" href="/integrations/wordpress/white-hat-cms-lite.php" download>Download connector plugin</a></div>
      </section>
      <div className="form-actions"><span>{message}</span><button className="btn btn-primary" type="submit">Save integrations</button></div>
    </form>
  );
}
