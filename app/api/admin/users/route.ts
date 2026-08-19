import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { recordAuditEvent } from "@/lib/audit";
import { listCmsUsers, roleCanManageUsers, upsertCmsUser, type CmsRole } from "@/lib/cms-users";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageUsers(user.role)) return unauthorized();
  return NextResponse.json({ users: await listCmsUsers() });
}

export async function POST(request: Request) {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageUsers(user.role)) return unauthorized();
  try {
    const input = (await request.json()) as {
      email?: string;
      displayName?: string;
      role?: CmsRole;
      status?: "active" | "disabled";
    };
    await upsertCmsUser({
      email: input.email || "",
      displayName: input.displayName,
      role: input.role || "author",
      status: input.status,
    });
    await recordAuditEvent({
      actorEmail: user.email,
      action: "user.saved",
      entityType: "user",
      entityId: input.email,
      details: { role: input.role, status: input.status || "active" },
    });
    return NextResponse.json({ users: await listCmsUsers() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The user could not be saved." },
      { status: 400 },
    );
  }
}

function unauthorized() {
  return NextResponse.json({ error: "Not authorized." }, { status: 401 });
}
