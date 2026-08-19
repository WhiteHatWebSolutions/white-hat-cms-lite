import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { roleCanWrite } from "@/lib/cms-users";
import { generateAiDraft } from "@/lib/integrations";
import { recordAuditEvent } from "@/lib/audit";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getBlogAdmin();
  if (!user || !roleCanWrite(user.role)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  try {
    await enforceRateLimit({ scope: "ai", identity: user.email, limit: 10, windowSeconds: 3600 });
    const input = await request.json() as { brief?: string; title?: string; purpose?: string; category?: string; targetLength?: number };
    if (!input.brief?.trim()) return NextResponse.json({ error: "Describe the post you want to draft." }, { status: 400 });
    const draft = await generateAiDraft({ ...input, brief: input.brief, actorEmail: user.email });
    await recordAuditEvent({ actorEmail: user.email, action: "ai.draft_generated", entityType: "post", details: { title: draft.title } });
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The draft could not be generated." }, { status: 400 });
  }
}
