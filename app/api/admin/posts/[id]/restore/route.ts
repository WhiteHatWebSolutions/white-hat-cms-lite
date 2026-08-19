import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { roleCanManageSettings } from "@/lib/cms-users";
import { restoreBlogPost } from "@/lib/posts";
import { recordAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageSettings(user.role)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id < 1 || !(await restoreBlogPost(id))) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  await recordAuditEvent({ actorEmail: user.email, action: "post.restored", entityType: "post", entityId: id });
  return NextResponse.json({ ok: true });
}
