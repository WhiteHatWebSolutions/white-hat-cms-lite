import type { Metadata } from "next";
import { AdminBlogShell } from "@/components/AdminBlogShell";
import { ThemeSettings } from "@/components/ThemeSettings";
import { requireCmsRole } from "@/lib/blog-admin-auth";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Appearance Settings",
  robots: { index: false, follow: false },
};

export default async function AppearanceSettingsPage() {
  const [user, settings] = await Promise.all([
    requireCmsRole("/admin/settings/", ["owner", "admin"]),
    getSiteSettings(),
  ]);

  return (
    <AdminBlogShell displayName={user.displayName}>
      <section className="admin-editor-heading">
        <p className="admin-kicker">Appearance and white label</p>
        <h1>Make the publication your own.</h1>
        <p>
          Change the public name, copy, colors, and styling without editing the
          application code.
        </p>
      </section>
      <ThemeSettings initialSettings={settings} />
    </AdminBlogShell>
  );
}
