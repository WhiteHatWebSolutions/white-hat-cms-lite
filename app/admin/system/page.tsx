import type { Metadata } from "next";
import { AdminBlogShell } from "@/components/AdminBlogShell";
import { DeliveryLog } from "@/components/DeliveryLog";
import { BackupRestore } from "@/components/BackupRestore";
import { requireCmsRole } from "@/lib/blog-admin-auth";
import { listAuditEvents } from "@/lib/audit";
import { listIntegrationDeliveries } from "@/lib/integrations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "System", robots: { index: false, follow: false } };

export default async function SystemPage() {
  const user = await requireCmsRole("/admin/system/", ["owner", "admin"]);
  const [events, deliveries] = await Promise.all([
    listAuditEvents(50), listIntegrationDeliveries(50),
  ]);
  return <AdminBlogShell displayName={user.displayName}>
    <section className="admin-hero">
      <div><p className="admin-kicker">Operations</p><h1>System and setup</h1><p>Verify installation, export portable data, and review administrative activity.</p></div>
      <div className="inline-actions"><a className="btn btn-primary" href="/api/admin/export/backup">Export backup</a><a className="btn btn-secondary" href="/api/admin/export/wordpress">WordPress export</a></div>
    </section>
    <section className="admin-panel"><p className="admin-kicker">Launch checklist</p><div className="checklist-grid">
      <article><strong>Authorized users</strong><span>Add editors and reviewers under Team.</span></article>
      <article><strong>Publication identity</strong><span>Set branding, navigation, and domain under Appearance.</span></article>
      <article><strong>AI and distribution</strong><span>Connect an AI provider, Postiz, and any external publishing targets.</span></article>
      <article><strong>Media</strong><span>Upload publication assets and verify object storage.</span></article>
      <article><strong>Recovery</strong><span>Download a backup before major updates.</span></article>
    </div></section>
    <DeliveryLog initialDeliveries={deliveries as Record<string, unknown>[]} />
    {user.role === "owner" ? <BackupRestore /> : null}
    <section className="admin-panel"><div className="admin-section-heading"><div><p className="admin-kicker">Audit trail</p><h2>Recent activity</h2></div><span>{events.length} events</span></div><div className="data-list">
      {events.map((event) => { const row = event as Record<string, unknown>; return <article key={String(row.id)}><div><strong>{String(row.action)}</strong><span>{String(row.actor_email)} · {String(row.entity_type)} {String(row.entity_id || "")}</span></div><time>{new Date(String(row.created_at)).toLocaleString()}</time></article>; })}
      {!events.length && <p>No audit events recorded yet.</p>}
    </div></section>
  </AdminBlogShell>;
}
