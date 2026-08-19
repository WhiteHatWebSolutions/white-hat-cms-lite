import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { roleCanApprove, roleCanEditPost } from "@/lib/cms-users";
import { recordAuditEvent } from "@/lib/audit";
import { setPostApproval } from "@/lib/post-workflow";
import { dispatchDistributionEvent } from "@/lib/integrations";
import { getAdminPostById } from "@/lib/posts";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getBlogAdmin();
  if (!user) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const postId = Number((await context.params).id);
  if (!Number.isInteger(postId) || postId < 1) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
  const input = (await request.json()) as { status?: string };
  const allowed = ["draft", "review", "approved", "changes_requested"] as const;
  if (!allowed.includes(input.status as (typeof allowed)[number])) {
    return NextResponse.json({ error: "Choose a valid approval status." }, { status: 400 });
  }
  const post = await getAdminPostById(postId);
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  const requestingReview = input.status === "review";
  if (requestingReview ? !roleCanEditPost(user, post) : !roleCanApprove(user.role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  await setPostApproval({
    postId,
    approvalStatus: input.status as (typeof allowed)[number],
    actorEmail: user.email,
  });
  await recordAuditEvent({
    actorEmail: user.email,
    action: `post.${input.status}`,
    entityType: "post",
    entityId: postId,
  });
  if (input.status === "approved" && (post.status === "scheduled" || post.status === "published")) {
    try {
      await dispatchDistributionEvent({ ...post, approvalStatus: "approved" }, post.status);
    } catch (error) {
      await recordAuditEvent({ actorEmail: user.email, action: "distribution.delivery_failed",
        entityType: "post", entityId: post.id,
        details: { message: error instanceof Error ? error.message : "Unknown error" } });
    }
  }
  return NextResponse.json({ ok: true });
}
