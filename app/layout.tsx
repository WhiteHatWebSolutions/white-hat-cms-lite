import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { siteConfig } from "@/config/site";
import { getPublicSiteUrl } from "@/lib/public-url";
import { getSiteSettings } from "@/lib/site-settings";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const publicUrl = await getPublicSiteUrl(settings);
  const favicon = settings.faviconUrl || "/favicon.svg";
  return {
    metadataBase: new URL(publicUrl),
    title: {
      default: settings.siteName || siteConfig.name,
      template: `%s | ${settings.siteName || siteConfig.name}`,
    },
    description: settings.description || siteConfig.description,
    icons: { icon: favicon, shortcut: favicon },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <div className="site-bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
