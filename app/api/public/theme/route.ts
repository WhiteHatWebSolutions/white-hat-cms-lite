import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSiteSettings();
  const theme = {
    siteName: settings.siteName,
    tagline: settings.tagline,
    description: settings.description,
    primaryColor: settings.primaryColor,
    accentColor: settings.accentColor,
    backgroundColor: settings.backgroundColor,
    textColor: settings.textColor,
    logoUrl: settings.logoUrl,
    faviconUrl: settings.faviconUrl,
    headingFont: settings.headingFont,
    bodyFont: settings.bodyFont,
    layoutStyle: settings.layoutStyle,
    navigation: settings.navigation,
    updatedAt: settings.updatedAt,
  };
  return NextResponse.json(
    { theme },
    {
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
      },
    },
  );
}

export function OPTIONS() {
  return new Response(null, {
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
    },
  });
}
