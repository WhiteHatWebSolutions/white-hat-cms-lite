import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { roleCanManageIntegrations } from "@/lib/cms-users";
import { createPublishingConnector, listPublishingConnectors } from "@/lib/publishing-connectors";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageIntegrations(user.role)) return unauthorized();
  return NextResponse.json({ connectors: await listPublishingConnectors() });
}

export async function POST(request: Request) {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageIntegrations(user.role)) return unauthorized();
  try {
    await enforceRateLimit({ scope: "connector-write", identity: user.email, limit: 20, windowSeconds: 60 });
    const connector = await createPublishingConnector(await request.json());
    await recordAuditEvent({ actorEmail: user.email, action: "connector.created", entityType: "connector", entityId: connector.id, details: { provider: connector.provider, name: connector.name } });
    return NextResponse.json({ connector }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Connector could not be created." }, { status: 400 });
  }
}

function unauthorized() { return NextResponse.json({ error: "Not authorized." }, { status: 401 }); }
