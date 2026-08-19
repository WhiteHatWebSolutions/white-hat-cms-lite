import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { roleCanManageIntegrations } from "@/lib/cms-users";
import { deletePublishingConnector, updatePublishingConnector } from "@/lib/publishing-connectors";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageIntegrations(user.role)) return unauthorized();
  const id = connectorId(await context.params);
  if (!id) return notFound();
  try {
    await enforceRateLimit({ scope: "connector-write", identity: user.email, limit: 20, windowSeconds: 60 });
    const connector = await updatePublishingConnector(id, await request.json());
    await recordAuditEvent({ actorEmail: user.email, action: "connector.updated", entityType: "connector", entityId: id, details: { provider: connector.provider, name: connector.name } });
    return NextResponse.json({ connector });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    const message = error instanceof Error ? error.message : "Connector could not be updated.";
    return NextResponse.json({ error: message }, { status: message === "Connector not found." ? 404 : 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageIntegrations(user.role)) return unauthorized();
  const id = connectorId(await context.params);
  if (!id) return notFound();
  try {
    await enforceRateLimit({ scope: "connector-write", identity: user.email, limit: 20, windowSeconds: 60 });
    if (!(await deletePublishingConnector(id))) return notFound();
    await recordAuditEvent({ actorEmail: user.email, action: "connector.deleted", entityType: "connector", entityId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return NextResponse.json({ error: "Connector could not be deleted." }, { status: 500 });
  }
}

function connectorId(params: { id: string }) { const id = Number(params.id); return Number.isInteger(id) && id > 0 ? id : 0; }
function unauthorized() { return NextResponse.json({ error: "Not authorized." }, { status: 401 }); }
function notFound() { return NextResponse.json({ error: "Connector not found." }, { status: 404 }); }
