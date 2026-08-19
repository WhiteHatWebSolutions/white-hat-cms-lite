import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { recordAuditEvent } from "@/lib/audit";
import { roleCanApprove, roleCanWrite } from "@/lib/cms-users";
import { savePostRevision } from "@/lib/post-workflow";
import { dispatchDistributionEvent } from "@/lib/integrations";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit";
import {
  BlogValidationError,
  createBlogPost,
  type BlogPostInput,
} from "@/lib/posts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getBlogAdmin();
  if (!user || !roleCanWrite(user.role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  try {
    await enforceRateLimit({ scope: "post-write", identity: user.email, limit: 120, windowSeconds: 60 });
    const input = (await request.json()) as BlogPostInput;
    const post = await createBlogPost(input, {
      email: user.email,
      canApprove: roleCanApprove(user.role),
    });
    await savePostRevision(post, user.email);
    await recordAuditEvent({
      actorEmail: user.email,
      action: "post.created",
      entityType: "post",
      entityId: post.id,
      details: { status: post.status, title: post.title },
    });
    await sendDistributionEvent(post, user.email);
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    return blogErrorResponse(error);
  }
}

async function sendDistributionEvent(post: Awaited<ReturnType<typeof createBlogPost>>, actorEmail: string) {
  if (post.approvalStatus !== "approved" || (post.status !== "scheduled" && post.status !== "published")) return;
  try {
    await dispatchDistributionEvent(post, post.status);
  } catch (error) {
    await recordAuditEvent({ actorEmail, action: "distribution.delivery_failed", entityType: "post", entityId: post.id, details: { message: error instanceof Error ? error.message : "Unknown error" } });
  }
}

function blogErrorResponse(error: unknown) {
  if (error instanceof BlogValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
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
