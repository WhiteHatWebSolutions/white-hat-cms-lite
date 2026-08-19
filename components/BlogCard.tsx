import Link from "next/link";
import type { PublicPost } from "@/lib/posts";

export function BlogCard({ post }: { post: PublicPost }) {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${post.publishDate}T00:00:00Z`));

  return (
    <article className="blog-card">
      <Link className="card-link" href={`/blog/${post.slug}/`}>
        <span className="tag">{post.category}</span>
        <h3>{post.title}</h3>
        <p>{post.description}</p>
        <time dateTime={post.publishDate}>{date}</time>
      </Link>
    </article>
  );
}
