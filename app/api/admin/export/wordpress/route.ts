import { getBlogAdmin } from "@/lib/blog-admin-auth";
import { getAdminPosts } from "@/lib/posts";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getBlogAdmin())) return new Response("Not authorized", { status: 401 });
  const [posts, settings] = await Promise.all([getAdminPosts(), getSiteSettings()]);
  const items = posts.filter((post) => post.status !== "planned").map((post) => { const dateTime = `${post.publishDate} ${post.publishTime}:00`; return `<item><title>${xml(post.title)}</title><link>${xml(`/blog/${post.slug}/`)}</link><pubDate>${new Date(`${post.publishDate}T${post.publishTime}:00Z`).toUTCString()}</pubDate><dc:creator><![CDATA[${cdata(post.authorEmail || "editor")}]]></dc:creator><content:encoded><![CDATA[${cdata(markdownToHtml(post.content))}]]></content:encoded><excerpt:encoded><![CDATA[${cdata(post.description)}]]></excerpt:encoded><wp:post_name>${xml(post.slug)}</wp:post_name><wp:post_date>${dateTime}</wp:post_date><wp:post_date_gmt>${dateTime}</wp:post_date_gmt><wp:status>${post.status === "published" ? "publish" : post.status === "scheduled" ? "future" : "draft"}</wp:status><wp:post_type>post</wp:post_type><category domain="category" nicename="${xml(slug(post.category))}"><![CDATA[${cdata(post.category)}]]></category></item>`; }).join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:wp="http://wordpress.org/export/1.2/"><channel><title>${xml(settings.siteName)}</title><description>${xml(settings.description)}</description><wp:wxr_version>1.2</wp:wxr_version>${items}</channel></rss>`;
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "content-disposition": "attachment; filename=white-hat-cms-lite-wordpress.xml" } });
}
function xml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function cdata(value: string) { return value.replace(/]]>/g, "]]]]><![CDATA[>"); }
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function markdownToHtml(value: string) { return value.split(/\n\n+/).map((block) => { const text = block.trim(); if (text.startsWith("### ")) return `<h3>${xml(text.slice(4))}</h3>`; if (text.startsWith("## ")) return `<h2>${xml(text.slice(3))}</h2>`; return `<p>${xml(text).replace(/\n/g, "<br>")}</p>`; }).join("\n"); }
