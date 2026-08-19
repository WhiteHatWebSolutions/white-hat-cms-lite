import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostContent } from "@/components/PostContent";
import { SectionCard } from "@/components/SectionCard";
import { SiteShell } from "@/components/SiteShell";
import { getPublishedPostBySlug } from "@/lib/posts";
import { getSiteSettings } from "@/lib/site-settings";
import { siteConfig } from "@/config/site";
import { zonedLocalToUtc } from "@/lib/time.mjs";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  const settings = await getSiteSettings();

  if (!post) {
    return {};
  }

  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.description,
    alternates: {
      canonical: `/blog/${post.slug}/`,
    },
    openGraph: {
      type: "article",
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.description,
      publishedTime: zonedLocalToUtc(post.publishDate, post.publishTime, siteConfig.timeZone).toISOString(),
      siteName: settings.siteName,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const date = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${post.publishDate}T00:00:00Z`));

  return (
    <SiteShell>
      <SectionCard className="article-card">
        <Link className="back-link" href="/">
          Back to journal
        </Link>
        <p className="eyebrow">
          {post.category} · {date}
        </p>
        <h1>{post.title}</h1>
        <p className="article-description">{post.description}</p>
        <PostContent content={post.content} />
      </SectionCard>
    </SiteShell>
  );
}
