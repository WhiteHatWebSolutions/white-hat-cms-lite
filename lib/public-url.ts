import "server-only";
import { siteConfig } from "@/config/site";
import type { SiteSettings } from "@/lib/site-settings";

export async function getPublicSiteUrl(
  settings?: Pick<SiteSettings, "customDomain">,
): Promise<string> {
  if (settings?.customDomain) return `https://${settings.customDomain}`;

  try {
    const { env } = await import("cloudflare:workers");
    const configured = (env as unknown as { PUBLIC_SITE_URL?: string })
      .PUBLIC_SITE_URL;
    if (configured) return normalizePublicUrl(configured);
  } catch {
    // Build-time rendering does not expose the worker environment.
  }

  return normalizePublicUrl(process.env.PUBLIC_SITE_URL || siteConfig.url);
}

export function normalizePublicUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("The public site URL must use HTTP or HTTPS.");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
