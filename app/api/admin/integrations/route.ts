import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { roleCanManageUsers } from "@/lib/cms-users";
import { getIntegrationSettings, updateIntegrationSettings } from "@/lib/integrations";
import { recordAuditEvent } from "@/lib/audit";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageUsers(user.role)) return unauthorized();
  return NextResponse.json({ settings: await getIntegrationSettings() });
}

export async function PATCH(request: Request) {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageUsers(user.role)) return unauthorized();
  try {
    await enforceRateLimit({ scope: "integration-write", identity: user.email, limit: 20, windowSeconds: 60 });
    const settings = await updateIntegrationSettings(await request.json());
    await recordAuditEvent({ actorEmail: user.email, action: "integrations.updated", entityType: "settings" });
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Settings could not be saved." }, { status: 400 });
  }
}
function unauthorized() { return NextResponse.json({ error: "Not authorized." }, { status: 401 }); }
