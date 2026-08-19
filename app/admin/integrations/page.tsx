import type { Metadata } from "next";
import { AdminBlogShell } from "@/components/AdminBlogShell";
import { IntegrationSettingsForm } from "@/components/IntegrationSettingsForm";
import { PublishingConnectors } from "@/components/PublishingConnectors";
import { requireCmsRole } from "@/lib/blog-admin-auth";
import { getIntegrationSettings } from "@/lib/integrations";
import { listPublishingConnectors } from "@/lib/publishing-connectors";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Integrations", robots: { index: false, follow: false } };

export default async function IntegrationsPage() {
  const user = await requireCmsRole("/admin/integrations/", ["owner", "admin"]);
  const [settings, connectors] = await Promise.all([getIntegrationSettings(), listPublishingConnectors()]);
  return <AdminBlogShell displayName={user.displayName}><section className="admin-hero"><div><p className="admin-kicker">Connections</p><h1>AI and publishing integrations</h1><p>Connect writing, social distribution, automation, and external publishing platforms without exposing credentials to the browser.</p></div></section><IntegrationSettingsForm initialSettings={settings} /><PublishingConnectors initialConnectors={connectors} /></AdminBlogShell>;
}
