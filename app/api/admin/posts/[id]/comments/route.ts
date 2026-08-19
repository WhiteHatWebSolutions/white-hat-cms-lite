import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { addPostComment, listPostComments } from "@/lib/post-workflow";
import { recordAuditEvent } from "@/lib/audit";
import { getAdminPostById } from "@/lib/posts";
import { roleCanViewAllPosts } from "@/lib/cms-users";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getBlogAdmin();
  if (!user) return unauthorized();
  const postId = await readPostId(context);
  if (!postId || !(await mayAccess(user, postId))) return notFound();
  return NextResponse.json({ comments: await listPostComments(postId) });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getBlogAdmin();
  if (!user) return unauthorized();
  const postId = await readPostId(context);
  if (!postId || !(await mayAccess(user, postId))) return notFound();
  try {
    const input = (await request.json()) as { body?: string };
    await addPostComment(postId, input.body || "", user.email);
    await recordAuditEvent({
      actorEmail: user.email,
      action: "comment.created",
      entityType: "post",
      entityId: postId,
    });
    return NextResponse.json({ comments: await listPostComments(postId) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The comment could not be saved." },
      { status: 400 },
    );
  }
}
async function mayAccess(user: NonNullable<Awaited<ReturnType<typeof getBlogAdmin>>>, postId: number) {
  const post = await getAdminPostById(postId);
  return Boolean(post && (roleCanViewAllPosts(user.role) || post.authorEmail === user.email));
}

async function readPostId(context: RouteContext) {
  const id = Number((await context.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}
function unauthorized() { return NextResponse.json({ error: "Not authorized." }, { status: 401 }); }
function notFound() { return NextResponse.json({ error: "Post not found." }, { status: 404 }); }
