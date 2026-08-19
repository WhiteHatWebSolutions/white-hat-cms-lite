"use client";

import { useState } from "react";
import type { BlogPost } from "@/lib/posts";

export function TrashList({ initialPosts }: { initialPosts: BlogPost[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [message, setMessage] = useState("");
  async function restore(id: number) {
    const response = await fetch(`/api/admin/posts/${id}/restore`, { method: "POST" });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setMessage(result.error || "The post could not be restored."); return; }
    setPosts((current) => current.filter((post) => post.id !== id));
    setMessage("Post restored as an unapproved draft.");
  }
  return <section className="admin-panel"><p aria-live="polite">{message}</p><div className="data-list">{posts.map((post) => <article key={post.id}><div><strong>{post.title}</strong><span>Deleted {post.deletedAt ? new Date(post.deletedAt).toLocaleString() : ""}</span></div><button className="btn btn-secondary" type="button" onClick={() => void restore(post.id)}>Restore</button></article>)}{!posts.length ? <p>Trash is empty.</p> : null}</div></section>;
}
