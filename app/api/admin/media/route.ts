import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { roleCanWrite } from "@/lib/cms-users";
import { listMediaAssets, uploadMedia } from "@/lib/media";
import { recordAuditEvent } from "@/lib/audit";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getBlogAdmin())) return unauthorized();
  return NextResponse.json({ assets: await listMediaAssets() });
}

export async function POST(request: Request) {
  const user = await getBlogAdmin();
  if (!user || !roleCanWrite(user.role)) return unauthorized();
  try {
    await enforceRateLimit({ scope: "media", identity: user.email, limit: 30, windowSeconds: 3600 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
    const asset = await uploadMedia(file, String(form.get("altText") || ""), user.email);
    await recordAuditEvent({ actorEmail: user.email, action: "media.uploaded", entityType: "media", entityId: asset.id, details: { filename: asset.filename } });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The image could not be uploaded." }, { status: 400 });
  }
}
function unauthorized() { return NextResponse.json({ error: "Not authorized." }, { status: 401 }); }
