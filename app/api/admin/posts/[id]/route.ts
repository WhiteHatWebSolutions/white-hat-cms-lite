import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { recordAuditEvent } from "@/lib/audit";
import { roleCanApprove, roleCanEditPost, roleCanWrite } from "@/lib/cms-users";
import { savePostRevision } from "@/lib/post-workflow";
import { dispatchDistributionEvent } from "@/lib/integrations";
import {
  BlogValidationError,
  BlogConflictError,
  getAdminPostById,
  softDeleteBlogPost,
  updateBlogPost,
  type BlogPostInput,
} from "@/lib/posts";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getBlogAdmin();
  if (!user || !roleCanWrite(user.role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId < 1) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const current = await getAdminPostById(numericId);
  if (!current || !roleCanEditPost(user, current)) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  try {
    await enforceRateLimit({ scope: "post-write", identity: user.email, limit: 120, windowSeconds: 60 });
    const input = (await request.json()) as BlogPostInput;
    const post = await updateBlogPost(numericId, input, {
      email: user.email,
      canApprove: roleCanApprove(user.role),
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    await savePostRevision(post, user.email);
    await recordAuditEvent({
      actorEmail: user.email,
      action: "post.updated",
      entityType: "post",
      entityId: post.id,
      details: { status: post.status, title: post.title, version: post.version },
    });
    if (post.approvalStatus === "approved" && (post.status === "scheduled" || post.status === "published")) {
      try {
        await dispatchDistributionEvent(post, post.status);
      } catch (error) {
        await recordAuditEvent({ actorEmail: user.email, action: "distribution.delivery_failed", entityType: "post", entityId: post.id, details: { message: error instanceof Error ? error.message : "Unknown error" } });
      }
    }
    return NextResponse.json({ post });
  } catch (error) {
    return blogErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getBlogAdmin();
  if (!user || !roleCanWrite(user.role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  try {
    await enforceRateLimit({ scope: "post-write", identity: user.email, limit: 120, windowSeconds: 60 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    throw error;
  }
  const numericId = Number((await context.params).id);
  const post = Number.isInteger(numericId) ? await getAdminPostById(numericId) : null;
  if (!post || !roleCanEditPost(user, post) || !(await softDeleteBlogPost(numericId))) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
  await recordAuditEvent({ actorEmail: user.email, action: "post.trashed", entityType: "post", entityId: numericId });
  return NextResponse.json({ ok: true });
}

function blogErrorResponse(error: unknown) {
  if (error instanceof BlogValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof BlogConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof RateLimitError) return rateLimitResponse(error);

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: "Send a valid post payload." },
      { status: 400 },
    );
  }

  if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
    return NextResponse.json(
      { error: "That URL slug is already being used by another post." },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { error: "The post could not be saved." },
    { status: 500 },
  );
}
