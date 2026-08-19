import Link from "next/link";
import { siteConfig } from "@/config/site";

export default function HomePage() {
  return (
    <main className="product-page">
      <header className="product-header">
        <Link className="product-brand" href="/" aria-label={siteConfig.name}>
          <span className="brand-indicator" aria-hidden="true" />
          <span>{siteConfig.name}</span>
        </Link>
        <nav className="product-nav" aria-label="Primary navigation">
          <Link href="/blog/">Published posts</Link>
          <Link className="product-nav-cta" href="/admin/blog/">
            Open CMS
          </Link>
        </nav>
      </header>

      <section className="product-hero">
        <div>
          <p className="product-eyebrow">Lightweight publishing system</p>
          <h1>Publish clearly. Keep the process simple.</h1>
          <p>
            White Hat CMS Lite gives a small team one focused place to plan,
            write, schedule, and maintain a polished publication.
          </p>
          <div className="product-actions">
            <Link className="btn product-primary" href="/admin/blog/">
              Open the publishing desk
            </Link>
            <Link className="btn product-secondary" href="/blog/">
              View public posts
            </Link>
          </div>
        </div>

        <div className="product-preview" aria-label="CMS preview">
          <div className="preview-topbar">
            <span className="preview-dot" />
            <span>Publishing desk</span>
            <span className="preview-status">Ready</span>
          </div>
          <div className="preview-body">
            <div className="preview-sidebar">
              <span className="active" />
              <span />
              <span />
              <span />
            </div>
            <div className="preview-content">
              <span className="preview-label">EDITORIAL CALENDAR</span>
              <div className="preview-heading-row">
                <strong>All entries</strong>
                <span>New post</span>
              </div>
              <div className="preview-row">
                <span />
                <div>
                  <strong>Draft in progress</strong>
                  <small>Private workspace</small>
                </div>
                <em>Draft</em>
              </div>
              <div className="preview-row">
                <span />
                <div>
                  <strong>Scheduled post</strong>
                  <small>Ready to publish</small>
                </div>
                <em>Scheduled</em>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="product-features" aria-label="Core features">
        <article>
          <span className="feature-indicator" aria-hidden="true" />
          <h2>One focused workspace</h2>
          <p>
            Keep ideas, drafts, publish dates, and finished posts organized in
            one practical publishing desk.
          </p>
        </article>
        <article>
          <span className="feature-indicator" aria-hidden="true" />
          <h2>White-label controls</h2>
          <p>
            Set the publication name, colors, public copy, and custom CSS from
            the appearance workspace, without touching application code.
          </p>
        </article>
        <article>
          <span className="feature-indicator" aria-hidden="true" />
          <h2>Integration-ready delivery</h2>
          <p>
            Use the public posts and theme endpoints alongside WordPress or a
            custom frontend, with RSS, sitemap, and structured post data.
          </p>
        </article>
      </section>
    </main>
  );
}
