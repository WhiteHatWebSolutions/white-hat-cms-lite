import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { listAuditEvents } from "@/lib/audit";
import { roleCanManageUsers } from "@/lib/cms-users";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageUsers(user.role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  return NextResponse.json({ events: await listAuditEvents() });
}
