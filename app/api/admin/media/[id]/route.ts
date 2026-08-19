import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { roleCanManageUsers } from "@/lib/cms-users";
import { deleteMediaAsset } from "@/lib/media";
import { recordAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageUsers(user.role)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  try {
    if (!(await deleteMediaAsset(id))) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    await recordAuditEvent({ actorEmail: user.email, action: "media.deleted", entityType: "media", entityId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The image could not be deleted." }, { status: 409 });
  }
}
