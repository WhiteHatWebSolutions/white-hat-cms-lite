"use client";

import { useState } from "react";

type Delivery = Record<string, unknown>;

export function DeliveryLog({ initialDeliveries }: { initialDeliveries: Delivery[] }) {
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [message, setMessage] = useState("");
  async function retry(id: number) {
    setMessage("Retrying delivery...");
    const response = await fetch("/api/admin/integrations/deliveries", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setMessage(result.error || "Delivery failed."); return; }
    const refreshed = await fetch("/api/admin/integrations/deliveries").then((item) => item.json()) as { deliveries?: Delivery[] };
    setDeliveries(refreshed.deliveries || []);
    setMessage("Delivery succeeded.");
  }
  return <section className="admin-panel"><div className="admin-section-heading"><div><p className="admin-kicker">Distribution</p><h2>Delivery log</h2></div><span>{deliveries.length} deliveries</span></div><small>{message}</small><div className="data-list">{deliveries.map((delivery) => <article key={String(delivery.id)}><div><strong>{String(delivery.provider)} · {String(delivery.event_type)} · post {String(delivery.post_id)}</strong><span>{String(delivery.status)} · {String(delivery.attempts)} attempts</span>{delivery.external_url ? <a className="admin-text-link" href={String(delivery.external_url)} target="_blank" rel="noopener noreferrer">Open external item</a> : null}{delivery.last_error ? <small className="is-error">{String(delivery.last_error)}</small> : null}</div>{delivery.status !== "succeeded" ? <button className="btn btn-secondary" type="button" onClick={() => void retry(Number(delivery.id))}>Retry</button> : null}</article>)}{!deliveries.length ? <p>No distribution deliveries recorded yet.</p> : null}</div></section>;
}
