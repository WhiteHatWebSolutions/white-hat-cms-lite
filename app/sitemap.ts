import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/public-url";
import { getPublishedPosts } from "@/lib/posts";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, settings] = await Promise.all([
    getPublishedPosts(),
    getSiteSettings(),
  ]);
  const publicUrl = await getPublicSiteUrl(settings);

  return [
    {
      url: publicUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...posts.map((post) => ({
      url: `${publicUrl}/blog/${post.slug}/`,
      lastModified: post.publishDate,
      changeFrequency: "monthly" as const,
      priority: post.featured ? 0.9 : 0.7,
    })),
  ];
}
