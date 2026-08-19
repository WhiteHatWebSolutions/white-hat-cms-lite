import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { roleCanManageIntegrations } from "@/lib/cms-users";
import { testPublishingConnector } from "@/lib/publishing-connectors";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageIntegrations(user.role)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Connector not found." }, { status: 404 });
  try {
    await enforceRateLimit({ scope: "connector-test", identity: user.email, limit: 10, windowSeconds: 60 });
    await testPublishingConnector(id);
    await recordAuditEvent({ actorEmail: user.email, action: "connector.test_succeeded", entityType: "connector", entityId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    const message = error instanceof Error ? error.message : "Connection test failed.";
    await recordAuditEvent({ actorEmail: user.email, action: "connector.test_failed", entityType: "connector", entityId: id, details: { message } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
