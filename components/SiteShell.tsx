/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { getSiteSettings } from "@/lib/site-settings";

export async function SiteShell({ children }: { children: ReactNode }) {
  const settings = await getSiteSettings();
  const themeVariables = {
    "--publication-primary": settings.primaryColor,
    "--publication-accent": settings.accentColor,
    "--publication-background": settings.backgroundColor,
    "--publication-text": settings.textColor,
    "--publication-heading-font": settings.headingFont,
    "--publication-body-font": settings.bodyFont,
  } as CSSProperties;

  return (
    <main className={`publication-page publication-layout-${settings.layoutStyle}`} style={themeVariables}>
      {settings.faviconUrl ? <link rel="icon" href={settings.faviconUrl} /> : null}
      {settings.customCss ? <style>{settings.customCss}</style> : null}
      <header className="publication-header">
        <Link className="publication-brand" href="/">
          {settings.logoUrl ? (
            <img className="publication-logo" src={settings.logoUrl} alt="" />
          ) : (
            <span className="brand-indicator" aria-hidden="true" />
          )}
          <span>{settings.siteName}</span>
        </Link>
        <nav className="publication-nav" aria-label="Publication navigation">
          {settings.navigation.map((item) => (
            <Link key={`${item.label}-${item.url}`} href={item.url}>
              {item.label}
            </Link>
          ))}
          <Link className="publication-admin-link" href="/admin/blog/">
            CMS
          </Link>
        </nav>
      </header>
      <div className="publication-content">{children}</div>
      <footer className="publication-footer">
        © {new Date().getFullYear()} {settings.siteName}
      </footer>
    </main>
  );
}
