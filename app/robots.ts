import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/public-url";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSiteSettings();
  const publicUrl = await getPublicSiteUrl(settings);
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/"],
    },
    sitemap: `${publicUrl}/sitemap.xml`,
  };
}
