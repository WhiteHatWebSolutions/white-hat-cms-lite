import type { Metadata } from "next";
import { AdminBlogShell } from "@/components/AdminBlogShell";
import { MediaLibrary } from "@/components/MediaLibrary";
import { requireBlogAdmin } from "@/lib/blog-admin-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Media Library", robots: { index: false, follow: false } };
export default async function MediaPage() { const user = await requireBlogAdmin("/admin/media/"); return <AdminBlogShell displayName={user.displayName}><section className="admin-hero"><div><p className="admin-kicker">Assets</p><h1>Media library</h1><p>Upload optimized publication images and copy ready-to-use article markup.</p></div></section><MediaLibrary /></AdminBlogShell>; }
