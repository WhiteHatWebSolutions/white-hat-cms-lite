import type { Metadata } from "next";
import { AdminBlogShell } from "@/components/AdminBlogShell";
import { BlogEditor } from "@/components/BlogEditor";
import { requireBlogAdmin } from "@/lib/blog-admin-auth";
import { roleCanWrite } from "@/lib/cms-users";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Blog Post",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function NewBlogPostPage() {
  const user = await requireBlogAdmin("/admin/blog/new/");
  if (!roleCanWrite(user.role)) redirect("/admin/blog/");

  return (
    <AdminBlogShell displayName={user.displayName}>
      <section className="admin-editor-heading">
        <p className="admin-kicker">New content</p>
        <h1>Create a post.</h1>
      </section>
      <BlogEditor />
    </AdminBlogShell>
  );
}
