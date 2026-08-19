import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminBlogShell } from "@/components/AdminBlogShell";
import { BlogEditor } from "@/components/BlogEditor";
import { requireBlogAdmin } from "@/lib/blog-admin-auth";
import { roleCanApprove, roleCanEditPost, roleCanViewAllPosts } from "@/lib/cms-users";
import { getAdminPostById } from "@/lib/posts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit Blog Post",
  robots: {
    index: false,
    follow: false,
  },
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditBlogPostPage({ params }: PageProps) {
  const { id } = await params;
  const returnTo = `/admin/blog/${encodeURIComponent(id)}/`;
  const user = await requireBlogAdmin(returnTo);
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId < 1) {
    notFound();
  }

  const post = await getAdminPostById(numericId);
  if (!post) {
    notFound();
  }
  if (!roleCanViewAllPosts(user.role) && post.authorEmail !== user.email) {
    notFound();
  }

  return (
    <AdminBlogShell displayName={user.displayName}>
      <section className="admin-editor-heading">
        <p className="admin-kicker">Edit content</p>
        <h1>{post.title}</h1>
      </section>
      <BlogEditor post={post} canWrite={roleCanEditPost(user, post)} canApprove={roleCanApprove(user.role)} />
    </AdminBlogShell>
  );
}
