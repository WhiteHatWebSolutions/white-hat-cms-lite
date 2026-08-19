import type { Metadata } from "next";
import { AdminBlogShell } from "@/components/AdminBlogShell";
import { TrashList } from "@/components/TrashList";
import { requireCmsRole } from "@/lib/blog-admin-auth";
import { listDeletedPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Trash", robots: { index: false, follow: false } };

export default async function TrashPage() {
  const user = await requireCmsRole("/admin/trash/", ["owner", "admin"]);
  const posts = await listDeletedPosts();
  return <AdminBlogShell displayName={user.displayName}><section className="admin-editor-heading"><p className="admin-kicker">Recovery</p><h1>Trashed posts</h1><p>Restored posts return as private, unapproved drafts.</p></section><TrashList initialPosts={posts} /></AdminBlogShell>;
}
