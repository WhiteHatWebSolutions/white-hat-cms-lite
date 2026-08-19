import "server-only";
import { getD1 } from "@/db";
import type { BlogPost } from "@/lib/posts";

export async function savePostRevision(post: BlogPost, changedBy: string) {
  const db = await getD1();
  await db
    .prepare(
      `INSERT INTO post_revisions
       (post_id, version, snapshot_json, changed_by)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(post.id, post.version, JSON.stringify(post), changedBy)
    .run();
}

export async function listPostRevisions(postId: number) {
  const db = await getD1();
  const result = await db
    .prepare(
      `SELECT id, post_id, version, snapshot_json, changed_by, created_at
       FROM post_revisions WHERE post_id = ? ORDER BY version DESC`,
    )
    .bind(postId)
    .all();
  return result.results;
}

export async function listPostComments(postId: number) {
  const db = await getD1();
  const result = await db
    .prepare(
      `SELECT id, post_id, body, author_email, resolved, created_at
       FROM post_comments WHERE post_id = ? ORDER BY id DESC`,
    )
    .bind(postId)
    .all();
  return result.results;
}

export async function addPostComment(postId: number, body: string, authorEmail: string) {
  const clean = body.trim();
  if (!clean) throw new Error("Comment text is required.");
  if (clean.length > 2000) throw new Error("Comments must be 2,000 characters or fewer.");
  const db = await getD1();
  await db
    .prepare(
      `INSERT INTO post_comments (post_id, body, author_email) VALUES (?, ?, ?)`,
    )
    .bind(postId, clean, authorEmail)
    .run();
}

export async function setPostApproval(input: {
  postId: number;
  approvalStatus: "draft" | "review" | "approved" | "changes_requested";
  actorEmail: string;
}) {
  const db = await getD1();
  const approved = input.approvalStatus === "approved";
  await db
    .prepare(
      `UPDATE blog_posts SET approval_status = ?, approved_by = ?, approved_at = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.approvalStatus,
      approved ? input.actorEmail : "",
      approved ? new Date().toISOString() : null,
      new Date().toISOString(),
      input.postId,
    )
    .run();
}
