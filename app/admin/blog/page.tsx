import type { Metadata } from "next";
import Link from "next/link";
import { AdminBlogShell } from "@/components/AdminBlogShell";
import { siteConfig } from "@/config/site";
import { requireBlogAdmin } from "@/lib/blog-admin-auth";
import { getAdminPosts, type BlogPost } from "@/lib/posts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Publishing Desk",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function BlogAdminPage() {
  const user = await requireBlogAdmin("/admin/blog/");
  const posts = await getAdminPosts(user);
  const counts = countStatuses(posts);

  return (
    <AdminBlogShell displayName={user.displayName}>
      <section className="admin-hero">
        <div>
          <p className="admin-kicker">Content calendar</p>
          <h1>Plan content. Publish with control.</h1>
          <p>
            Keep each entry organized from first note to final publication.
            Public visibility is controlled by content readiness, status, and
            publishing date.
          </p>
        </div>
        <Link className="btn btn-primary" href="/admin/blog/new/">
          New post
        </Link>
      </section>

      <section className="admin-stat-grid" aria-label="Blog status summary">
        <article>
          <strong>{posts.length}</strong>
          <span>All entries</span>
        </article>
        <article>
          <strong>{counts.planned}</strong>
          <span>Planned</span>
        </article>
        <article>
          <strong>{counts.draft}</strong>
          <span>Drafts</span>
        </article>
        <article>
          <strong>{counts.ready}</strong>
          <span>Scheduled or published</span>
        </article>
      </section>

      <section className="admin-calendar">
        <div className="admin-section-heading">
          <div>
            <p className="admin-kicker">Publishing workflow</p>
            <h2>Content calendar</h2>
          </div>
          <p>{posts.length} entries</p>
        </div>

        <div className="admin-post-list">
          {posts.map((post) => (
            <article className="admin-post-row" key={post.id}>
              <time dateTime={post.publishDate}>
                <strong>{formatMonth(post.publishDate)}</strong>
                <span>{formatDay(post.publishDate)}</span>
              </time>
              <div className="admin-post-copy">
                <div className="admin-post-meta">
                  <span className={`status-pill status-${post.status}`}>
                    {statusLabel(post)}
                  </span>
                  <span>{post.category}</span>
                </div>
                <h3>{post.title}</h3>
                <p>{post.purpose || "No private direction has been added."}</p>
              </div>
              <Link
                className="admin-edit-link"
                href={`/admin/blog/${post.id}/`}
                aria-label={`Edit ${post.title}`}
              >
                Edit
              </Link>
            </article>
          ))}
        </div>
      </section>
    </AdminBlogShell>
  );
}

function countStatuses(posts: BlogPost[]) {
  return posts.reduce(
    (counts, post) => {
      if (post.status === "planned") counts.planned += 1;
      if (post.status === "draft") counts.draft += 1;
      if (post.status === "scheduled" || post.status === "published") {
        counts.ready += 1;
      }
      return counts;
    },
    { planned: 0, draft: 0, ready: 0 },
  );
}

function formatMonth(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function statusLabel(post: BlogPost) {
  if (
    (post.status === "scheduled" || post.status === "published") &&
    post.publishDate <= configuredDateString()
  ) {
    return "Live";
  }

  return post.status.charAt(0).toUpperCase() + post.status.slice(1);
}

function configuredDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: siteConfig.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
