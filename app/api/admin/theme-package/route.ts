import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { roleCanManageSettings } from "@/lib/cms-users";
import { getSiteSettings, updateSiteSettings, SiteSettingsValidationError } from "@/lib/site-settings";
import { recordAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageSettings(user.role)) return unauthorized();
  const settings = await getSiteSettings();
  const theme = Object.fromEntries(Object.entries(settings).filter(([key]) => key !== "updatedAt"));
  return new NextResponse(JSON.stringify({ format: "white-hat-cms-lite-theme", version: 1, theme }, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": "attachment; filename=white-hat-cms-lite-theme.json" },
  });
}

export async function POST(request: Request) {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageSettings(user.role)) return unauthorized();
  try {
    const input = await request.json() as { format?: string; version?: number; theme?: unknown };
    if (input.format !== "white-hat-cms-lite-theme" || input.version !== 1 || !input.theme) {
      return NextResponse.json({ error: "Choose a valid White Hat CMS Lite theme package." }, { status: 400 });
    }
    const settings = await updateSiteSettings(input.theme as Parameters<typeof updateSiteSettings>[0]);
    await recordAuditEvent({ actorEmail: user.email, action: "theme.imported", entityType: "settings" });
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof SiteSettingsValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "The theme package could not be imported." }, { status: 400 });
  }
}

function unauthorized() { return NextResponse.json({ error: "Not authorized." }, { status: 401 }); }
