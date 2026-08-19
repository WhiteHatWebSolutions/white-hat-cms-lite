import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { listPostRevisions } from "@/lib/post-workflow";
import { getAdminPostById } from "@/lib/posts";
import { roleCanViewAllPosts } from "@/lib/cms-users";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getBlogAdmin();
  if (!user) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
  const post = await getAdminPostById(id);
  if (!post || (!roleCanViewAllPosts(user.role) && post.authorEmail !== user.email)) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
  return NextResponse.json({ revisions: await listPostRevisions(id) });
}
