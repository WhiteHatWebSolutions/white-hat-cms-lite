import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { restoreBackup, type BackupDocument } from "@/lib/backup";
import { recordAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getBlogAdmin();
  if (!user || user.role !== "owner") return NextResponse.json({ error: "Only the owner can restore backups." }, { status: 403 });
  try {
    const input = await request.json() as { confirmation?: string; backup?: BackupDocument };
    if (input.confirmation !== "RESTORE" || !input.backup) return NextResponse.json({ error: "Type RESTORE to confirm replacement of CMS data." }, { status: 400 });
    await restoreBackup(input.backup);
    await recordAuditEvent({ actorEmail: user.email, action: "backup.restored", entityType: "system" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The backup could not be restored." }, { status: 400 });
  }
}
