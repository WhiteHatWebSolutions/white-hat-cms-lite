import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { roleCanManageUsers } from "@/lib/cms-users";
import { recordAuditEvent } from "@/lib/audit";
import { createBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageUsers(user.role)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  const backup = await createBackup();
  await recordAuditEvent({ actorEmail: user.email, action: "backup.exported", entityType: "system" });
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(backup, null, 2), { headers: {
    "content-type": "application/json", "content-disposition": `attachment; filename="white-hat-cms-lite-backup-${date}.json"`,
  } });
}
