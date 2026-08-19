import "server-only";
import { getD1, getOptionalD1 } from "@/db";
import { assertPublicHttpsUrl } from "@/lib/connector-contract.mjs";

export type SiteSettings = {
  siteName: string;
  tagline: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  customCss: string;
  logoUrl: string;
  faviconUrl: string;
  headingFont: string;
  bodyFont: string;
  layoutStyle: "editorial" | "minimal" | "wide";
  navigation: Array<{ label: string; url: string }>;
  customDomain: string;
  updatedAt: string;
};

export type SiteSettingsInput = Partial<Omit<SiteSettings, "updatedAt">>;

type SiteSettingsRow = {
  site_name: string;
  tagline: string;
  description: string;
  primary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  custom_css: string;
  logo_url: string;
  favicon_url: string;
  heading_font: string;
  body_font: string;
  layout_style: string;
  navigation_json: string;
  custom_domain: string;
  updated_at: string;
};

export const defaultSiteSettings: SiteSettings = {
  siteName: "White Hat CMS Lite",
  tagline: "A lightweight publication platform.",
  description:
    "A focused home for articles, updates, and the ideas worth sharing.",
  primaryColor: "#FFFFFF",
  accentColor: "#65FF00",
  backgroundColor: "#050505",
  textColor: "#F4F7F5",
  customCss: "",
  logoUrl: "",
  faviconUrl: "",
  headingFont: "Inter",
  bodyFont: "Inter",
  layoutStyle: "editorial",
  navigation: [
    { label: "Articles", url: "/blog/" },
    { label: "RSS", url: "/feed.xml" },
  ],
  customDomain: "",
  updatedAt: "",
};

export async function getSiteSettings(): Promise<SiteSettings> {
  const db = await getOptionalD1();
  if (!db) return defaultSiteSettings;

  try {
    const row = await db
      .prepare(
        `SELECT site_name, tagline, description, primary_color, accent_color,
                background_color, text_color, custom_css, logo_url, favicon_url,
                heading_font, body_font, layout_style, navigation_json,
                custom_domain, updated_at
         FROM site_settings
         WHERE id = 1
         LIMIT 1`,
      )
      .first<SiteSettingsRow>();

    return row ? toSiteSettings(row) : defaultSiteSettings;
  } catch {
    return defaultSiteSettings;
  }
}

export async function updateSiteSettings(
  input: SiteSettingsInput,
): Promise<SiteSettings> {
  const settings = validateSiteSettings(input);
  const db = await getD1();
  const updatedAt = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO site_settings (
        id, site_name, tagline, description, primary_color, accent_color,
        background_color, text_color, custom_css, logo_url, favicon_url,
        heading_font, body_font, layout_style, navigation_json, custom_domain,
        updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        site_name = excluded.site_name,
        tagline = excluded.tagline,
        description = excluded.description,
        primary_color = excluded.primary_color,
        accent_color = excluded.accent_color,
        background_color = excluded.background_color,
        text_color = excluded.text_color,
        custom_css = excluded.custom_css,
        logo_url = excluded.logo_url,
        favicon_url = excluded.favicon_url,
        heading_font = excluded.heading_font,
        body_font = excluded.body_font,
        layout_style = excluded.layout_style,
        navigation_json = excluded.navigation_json,
        custom_domain = excluded.custom_domain,
        updated_at = excluded.updated_at`,
    )
    .bind(
      settings.siteName,
      settings.tagline,
      settings.description,
      settings.primaryColor,
      settings.accentColor,
      settings.backgroundColor,
      settings.textColor,
      settings.customCss,
      settings.logoUrl,
      settings.faviconUrl,
      settings.headingFont,
      settings.bodyFont,
      settings.layoutStyle,
      JSON.stringify(settings.navigation),
      settings.customDomain,
      updatedAt,
    )
    .run();

  return { ...settings, updatedAt };
}

export class SiteSettingsValidationError extends Error {}

function validateSiteSettings(input: SiteSettingsInput): Omit<
  SiteSettings,
  "updatedAt"
> {
  return {
    siteName: readRequired(input.siteName, "Publication name", 80),
    tagline: readRequired(input.tagline, "Tagline", 160),
    description: readRequired(input.description, "Description", 320),
    primaryColor: readColor(input.primaryColor, "Primary color"),
    accentColor: readColor(input.accentColor, "Accent color"),
    backgroundColor: readColor(input.backgroundColor, "Background color"),
    textColor: readColor(input.textColor, "Text color"),
    customCss: readCustomCss(input.customCss),
    logoUrl: readOptionalUrl(input.logoUrl, "Logo URL"),
    faviconUrl: readOptionalUrl(input.faviconUrl, "Favicon URL"),
    headingFont: readFont(input.headingFont),
    bodyFont: readFont(input.bodyFont),
    layoutStyle: readLayoutStyle(input.layoutStyle),
    navigation: readNavigation(input.navigation),
    customDomain: readOptionalDomain(input.customDomain),
  };
}

function toSiteSettings(row: SiteSettingsRow): SiteSettings {
  return {
    siteName: row.site_name,
    tagline: row.tagline,
    description: row.description,
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    backgroundColor: row.background_color,
    textColor: row.text_color,
    customCss: row.custom_css,
    logoUrl: row.logo_url,
    faviconUrl: row.favicon_url,
    headingFont: row.heading_font,
    bodyFont: row.body_font,
    layoutStyle: readLayoutStyle(row.layout_style),
    navigation: parseNavigation(row.navigation_json),
    customDomain: row.custom_domain,
    updatedAt: row.updated_at,
  };
}

function readRequired(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new SiteSettingsValidationError(`${label} is required.`);
  }

  const clean = value.trim();
  if (clean.length > maxLength) {
    throw new SiteSettingsValidationError(
      `${label} must be ${maxLength} characters or fewer.`,
    );
  }

  return clean;
}

function readOptional(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  if (value.length > maxLength) {
    throw new SiteSettingsValidationError(
      `Custom CSS must be ${maxLength} characters or fewer.`,
    );
  }
  return value;
}

function readCustomCss(value: unknown) {
  const css = readOptional(value, 10000);
  if (/@import|url\s*\(|expression\s*\(|javascript\s*:|<\s*\/\s*style/i.test(css)) {
    throw new SiteSettingsValidationError("Custom CSS cannot load external resources or contain executable markup.");
  }
  return css;
}

function readColor(value: unknown, label: string) {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new SiteSettingsValidationError(
      `${label} must be a six-digit hex color.`,
    );
  }
  return value.toUpperCase();
}

const ALLOWED_FONTS = ["Inter", "Arial", "Georgia", "Merriweather", "system-ui"];

function readFont(value: unknown) {
  return typeof value === "string" && ALLOWED_FONTS.includes(value)
    ? value
    : "Inter";
}

function readLayoutStyle(value: unknown): SiteSettings["layoutStyle"] {
  return value === "minimal" || value === "wide" ? value : "editorial";
}

function readOptionalUrl(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) return "";
  const clean = value.trim().slice(0, 500);
  if (clean.startsWith("/media/")) return clean;
  try {
    return assertPublicHttpsUrl(clean, label);
  } catch {}
  throw new SiteSettingsValidationError(
    `${label} must be a media-library path or HTTPS URL.`,
  );
}

function readOptionalDomain(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(clean)) {
    throw new SiteSettingsValidationError("Enter a valid custom domain.");
  }
  return clean;
}

function readNavigation(value: unknown) {
  if (!Array.isArray(value)) return defaultSiteSettings.navigation;
  return value.slice(0, 8).map((item) => {
    const entry = item as { label?: unknown; url?: unknown };
    const label = readRequired(entry.label, "Navigation label", 40);
    const url = typeof entry.url === "string" ? entry.url.trim().slice(0, 300) : "";
    if (!url.startsWith("/") && !/^https:\/\//.test(url)) {
      throw new SiteSettingsValidationError(
        "Navigation URLs must be relative paths or HTTPS URLs.",
      );
    }
    return { label, url };
  });
}

function parseNavigation(value: string) {
  try {
    return readNavigation(JSON.parse(value));
  } catch {
    return defaultSiteSettings.navigation;
  }
}
