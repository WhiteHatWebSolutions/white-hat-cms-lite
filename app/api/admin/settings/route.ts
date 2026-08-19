import { NextResponse } from "next/server";
import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { roleCanManageSettings } from "@/lib/cms-users";
import {
  getSiteSettings,
  SiteSettingsValidationError,
  updateSiteSettings,
  type SiteSettingsInput,
} from "@/lib/site-settings";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageSettings(user.role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  return NextResponse.json({ settings: await getSiteSettings() });
}

export async function PATCH(request: Request) {
  const user = await getBlogAdmin();
  if (!user || !roleCanManageSettings(user.role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  try {
    await enforceRateLimit({ scope: "settings-write", identity: user.email, limit: 30, windowSeconds: 60 });
    const input = (await request.json()) as SiteSettingsInput;
    const settings = await updateSiteSettings(input);
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof SiteSettingsValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Send a valid settings payload." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "The appearance settings could not be saved." },
      { status: 500 },
    );
  }
}
