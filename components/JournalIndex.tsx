import { BlogCard } from "@/components/BlogCard";
import { SectionCard } from "@/components/SectionCard";
import { SiteShell } from "@/components/SiteShell";
import { getPublishedPosts } from "@/lib/posts";

export async function JournalIndex() {
  const posts = await getPublishedPosts();

  return (
    <SiteShell>
      <SectionCard eyebrow="Published posts" title="Latest writing">
        <p>Articles that are ready for public reading appear here.</p>
        {posts.length ? (
          <div className="blog-grid full">
            {posts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <div className="blog-empty blog-empty-page">
            <span>No posts published</span>
            <h3>The publication is ready when the first post is.</h3>
            <p>Create, schedule, and publish content from the CMS workspace.</p>
          </div>
        )}
      </SectionCard>
    </SiteShell>
  );
}
