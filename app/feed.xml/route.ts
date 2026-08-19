import { getPublishedPosts } from "@/lib/posts";
import { getSiteSettings } from "@/lib/site-settings";
import { siteConfig } from "@/config/site";
import { zonedLocalToUtc } from "@/lib/time.mjs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const posts = await getPublishedPosts(50);
  const settings = await getSiteSettings();
  const origin = new URL(request.url).origin;
  const feedItems = posts
    .map((post) => {
      const articleUrl = `${origin}/blog/${post.slug}/`;
      return `
        <item>
          <title>${escapeXml(post.title)}</title>
          <link>${escapeXml(articleUrl)}</link>
          <guid isPermaLink="true">${escapeXml(articleUrl)}</guid>
          <pubDate>${zonedLocalToUtc(post.publishDate, post.publishTime, siteConfig.timeZone).toUTCString()}</pubDate>
          <description>${escapeXml(post.description)}</description>
        </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(settings.siteName)}</title>
    <link>${escapeXml(origin)}</link>
    <description>${escapeXml(settings.description)}</description>${feedItems}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '\"': "&quot;",
    };
    return entities[character];
  });
}
