import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { roleCanManageIntegrations } from "@/lib/cms-users";
import { listIntegrationDeliveries, retryIntegrationDelivery } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageIntegrations(user.role)) return unauthorized();
  return NextResponse.json({ deliveries: await listIntegrationDeliveries() });
}

export async function POST(request: Request) {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageIntegrations(user.role)) return unauthorized();
  const input = await request.json() as { id?: unknown };
  const id = Number(input.id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Choose a valid delivery." }, { status: 400 });
  try {
    await retryIntegrationDelivery(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delivery failed." }, { status: 502 });
  }
}

function unauthorized() {
  return NextResponse.json({ error: "Not authorized." }, { status: 401 });
}
