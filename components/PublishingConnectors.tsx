"use client";

import { useState, type FormEvent } from "react";
import { CONNECTOR_PROVIDERS, type ConnectorProvider } from "@/lib/connector-contract.mjs";
import type { PublishingConnector } from "@/lib/publishing-connectors";

type EditableConnector = Omit<PublishingConnector, "createdAt" | "updatedAt"> & { secret: string };

function editable(connector: PublishingConnector): EditableConnector {
  return { ...connector, secret: "" };
}

function blank(provider: ConnectorProvider): EditableConnector {
  const definition = CONNECTOR_PROVIDERS[provider];
  return { id: 0, provider, name: definition.label, config: Object.fromEntries(definition.fields.map((item) => [item.key, item.placeholder])), enabled: true, deliveryMode: "draft", connected: false, secret: "" };
}

export function PublishingConnectors({ initialConnectors }: { initialConnectors: PublishingConnector[] }) {
  const [connectors, setConnectors] = useState(initialConnectors.map(editable));
  const [creating, setCreating] = useState<EditableConnector | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    const result = await fetch("/api/admin/connectors").then((response) => response.json()) as { connectors?: PublishingConnector[] };
    setConnectors((result.connectors || []).map(editable));
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!creating) return;
    setMessage("Creating connector...");
    const response = await fetch("/api/admin/connectors", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(creating) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setMessage(result.error || "Connector could not be created."); return; }
    await refresh(); setCreating(null); setMessage("Connector created.");
  }

  async function save(connector: EditableConnector) {
    setMessage(`Saving ${connector.name}...`);
    const response = await fetch(`/api/admin/connectors/${connector.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(connector) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setMessage(result.error || "Connector could not be saved."); return; }
    await refresh(); setMessage(`${connector.name} saved.`);
  }

  async function test(connector: EditableConnector) {
    setMessage(`Testing ${connector.name}...`);
    const response = await fetch(`/api/admin/connectors/${connector.id}/test`, { method: "POST" });
    const result = await response.json() as { error?: string };
    setMessage(response.ok ? `${connector.name} connection succeeded.` : result.error || "Connection test failed.");
  }

  async function remove(connector: EditableConnector) {
    if (!window.confirm(`Remove ${connector.name}? Existing delivery history will remain.`)) return;
    setMessage(`Removing ${connector.name}...`);
    const response = await fetch(`/api/admin/connectors/${connector.id}`, { method: "DELETE" });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setMessage(result.error || "Connector could not be removed."); return; }
    await refresh(); setMessage("Connector removed.");
  }

  function update(id: number, mutate: (item: EditableConnector) => EditableConnector) {
    if (id === 0) setCreating((current) => current ? mutate(current) : current);
    else setConnectors((current) => current.map((item) => item.id === id ? mutate(item) : item));
    setMessage("");
  }

  return <section className="admin-panel">
    <div className="admin-section-heading"><div><p className="admin-kicker">Publishing network</p><h2>Platform connectors</h2></div><button className="btn btn-secondary" type="button" onClick={() => setCreating(blank("ghost"))}>Add connector</button></div>
    <p className="section-intro">Send approved content to popular publishing platforms. Draft delivery is safest and remains the default. Publish mode activates only when the local post is approved and published.</p>
    <div className="connector-grid">
      {connectors.map((connector) => <ConnectorEditor key={connector.id} connector={connector} onUpdate={(mutate) => update(connector.id, mutate)} onSave={() => void save(connector)} onTest={() => void test(connector)} onRemove={() => void remove(connector)} />)}
      {!connectors.length && !creating ? <div className="empty-state"><strong>No platform connectors yet.</strong><span>Add Ghost, Webflow, Contentful, Sanity, Strapi, HubSpot, Shopify, Drupal, or an automation webhook.</span></div> : null}
      {creating ? <form className="connector-card is-new" onSubmit={create}><ConnectorFields connector={creating} onUpdate={(mutate) => update(0, mutate)} allowProviderChange /><div className="inline-actions"><button className="btn btn-primary" type="submit">Create connector</button><button className="btn btn-secondary" type="button" onClick={() => setCreating(null)}>Cancel</button></div></form> : null}
    </div>
    <small className={message.toLowerCase().includes("failed") || message.toLowerCase().includes("could not") || message.toLowerCase().includes("returned") ? "is-error" : ""}>{message}</small>
  </section>;
}

function ConnectorEditor({ connector, onUpdate, onSave, onTest, onRemove }: {
  connector: EditableConnector; onUpdate: (mutate: (item: EditableConnector) => EditableConnector) => void;
  onSave: () => void; onTest: () => void; onRemove: () => void;
}) {
  return <article className="connector-card"><ConnectorFields connector={connector} onUpdate={onUpdate} />
    <div className="inline-actions"><button className="btn btn-primary" type="button" onClick={onSave}>Save</button><button className="btn btn-secondary" type="button" onClick={onTest}>Test</button><button className="admin-text-link danger-link" type="button" onClick={onRemove}>Remove</button></div>
  </article>;
}

function ConnectorFields({ connector, onUpdate, allowProviderChange = false }: {
  connector: EditableConnector; onUpdate: (mutate: (item: EditableConnector) => EditableConnector) => void; allowProviderChange?: boolean;
}) {
  const definition = CONNECTOR_PROVIDERS[connector.provider];
  function field(key: string, value: string) { onUpdate((item) => ({ ...item, config: { ...item.config, [key]: value } })); }
  function changeProvider(provider: ConnectorProvider) { const replacement = blank(provider); onUpdate((item) => ({ ...replacement, id: item.id })); }
  return <>
    <div className="connector-heading"><div><strong>{definition.label}</strong><span className={`connection-status ${connector.connected ? "is-connected" : ""}`}>{connector.connected ? "Credential saved" : "Credential needed"}</span></div><label className="toggle-label"><input type="checkbox" checked={connector.enabled} onChange={(event) => onUpdate((item) => ({ ...item, enabled: event.target.checked }))} /> Enabled</label></div>
    {allowProviderChange ? <label>Platform<select value={connector.provider} onChange={(event) => changeProvider(event.target.value as ConnectorProvider)}>{Object.entries(CONNECTOR_PROVIDERS).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label> : null}
    <label>Connection name<input value={connector.name} maxLength={100} onChange={(event) => onUpdate((item) => ({ ...item, name: event.target.value }))} required /></label>
    <div className="settings-grid-2">{definition.fields.map((item) => <label key={item.key}>{item.label}<input type={item.type} value={connector.config[item.key] || ""} placeholder={item.placeholder} onChange={(event) => field(item.key, event.target.value)} required /></label>)}</div>
    <div className="settings-grid-2"><label>{definition.secretLabel}<input type="password" autoComplete="new-password" value={connector.secret} onChange={(event) => onUpdate((item) => ({ ...item, secret: event.target.value }))} placeholder={connector.connected ? "Leave blank to keep saved credential" : "Paste credential"} /></label>
      <label>Delivery mode<select value={connector.deliveryMode} onChange={(event) => onUpdate((item) => ({ ...item, deliveryMode: event.target.value === "publish" ? "publish" : "draft" }))}><option value="draft">Create external draft</option><option value="publish">Publish after local approval</option></select></label></div>
    {connector.provider === "webhook" ? <small>Compatible with Zapier, Make, n8n, Pipedream, and custom HTTPS endpoints. Requests include an HMAC SHA-256 signature.</small> : null}
  </>;
}
