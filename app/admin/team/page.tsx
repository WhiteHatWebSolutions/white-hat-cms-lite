import type { Metadata } from "next";
import { AdminBlogShell } from "@/components/AdminBlogShell";
import { TeamSettings } from "@/components/TeamSettings";
import { requireCmsRole } from "@/lib/blog-admin-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team", robots: { index: false, follow: false } };

export default async function TeamPage() {
  const user = await requireCmsRole("/admin/team/", ["owner", "admin"]);
  return <AdminBlogShell displayName={user.displayName}><section className="admin-hero"><div><p className="admin-kicker">Access control</p><h1>Team and roles</h1><p>Control who can write, review, approve, and administer the publication.</p></div></section><TeamSettings /></AdminBlogShell>;
}
