import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { roleCanManageIntegrations } from "@/lib/cms-users";
import { testAiConnection } from "@/lib/integrations";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageIntegrations(user.role)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  try {
    await enforceRateLimit({ scope: "ai-test", identity: user.email, limit: 3, windowSeconds: 60 });
    await testAiConnection(user.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The AI connection test failed." }, { status: 502 });
  }
}
