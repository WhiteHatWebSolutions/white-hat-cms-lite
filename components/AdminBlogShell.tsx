import Link from "next/link";
import type { ReactNode } from "react";
import { signOutPath } from "@/app/auth";
import { siteConfig } from "@/config/site";

export function AdminBlogShell({
  children,
  displayName,
}: {
  children: ReactNode;
  displayName: string;
}) {
  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link
          className="admin-brand"
          href="/admin/blog/"
          aria-label={`${siteConfig.name} publishing desk`}
        >
          <span aria-hidden="true" />
          <div>
            <strong>White Hat CMS Lite</strong>
            <small>Content management system</small>
          </div>
        </Link>

        <nav className="admin-nav" aria-label="Publishing desk navigation">
          <Link href="/">Product home</Link>
          <Link href="/blog/">Published posts</Link>
          <Link href="/admin/media/">Media</Link>
          <Link href="/admin/trash/">Trash</Link>
          <Link href="/admin/settings/">Appearance</Link>
          <Link href="/admin/integrations/">Integrations</Link>
          <Link href="/admin/team/">Team</Link>
          <Link href="/admin/system/">System</Link>
          <a href={signOutPath("/")}>Sign out</a>
        </nav>
      </header>

      <div className="admin-welcome">
        <span>Secure content workspace</span>
        <p>{displayName}</p>
      </div>

      {children}
    </main>
  );
}
