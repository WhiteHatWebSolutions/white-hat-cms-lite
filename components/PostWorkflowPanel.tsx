"use client";

import { useEffect, useState } from "react";

type Comment = { id: number; body: string; author_email: string; created_at: string };
type Revision = { id: number; version: number; changed_by: string; created_at: string };

export function PostWorkflowPanel({ postId, approvalStatus, canApprove = false, canRequestReview = false }: { postId: number; approvalStatus: string; canApprove?: boolean; canRequestReview?: boolean }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState(approvalStatus);
  const [message, setMessage] = useState("");
  useEffect(() => {
    void Promise.all([
      fetch(`/api/admin/posts/${postId}/comments`).then((response) => response.json() as Promise<{ comments?: Comment[] }>),
      fetch(`/api/admin/posts/${postId}/revisions`).then((response) => response.json() as Promise<{ revisions?: Revision[] }>),
    ]).then(([commentResult, revisionResult]) => {
      setComments(commentResult.comments || []);
      setRevisions(revisionResult.revisions || []);
    });
  }, [postId]);
  async function addComment() { const response = await fetch(`/api/admin/posts/${postId}/comments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: comment }) }); const result = await response.json() as { comments?: Comment[]; error?: string }; if (!response.ok) { setMessage(result.error || "Comment could not be saved."); return; } setComments(result.comments || []); setComment(""); setMessage("Comment saved."); }
  async function approve(next: string) { const response = await fetch(`/api/admin/posts/${postId}/approval`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) }); const result = await response.json() as { error?: string }; if (!response.ok) { setMessage(result.error || "Approval could not be changed."); return; } setStatus(next); setMessage(`Approval set to ${next.replace(/_/g, " ")}.`); }
  return <section className="admin-panel workflow-panel"><p className="admin-kicker">Review workflow</p><strong className={`approval-pill approval-${status}`}>{status.replace(/_/g, " ")}</strong><div className="workflow-actions">{canRequestReview ? <button type="button" onClick={() => void approve("review")}>Request review</button> : null}{canApprove ? <><button type="button" onClick={() => void approve("approved")}>Approve</button><button type="button" onClick={() => void approve("changes_requested")}>Request changes</button></> : null}</div><label>Review comment<textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></label><button className="btn btn-secondary" type="button" onClick={() => void addComment()}>Add comment</button><small className={message.includes("could not") ? "is-error" : ""}>{message}</small><details><summary>Comments ({comments.length})</summary><div className="mini-list">{comments.map((item) => <article key={item.id}><strong>{item.author_email}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></article>)}</div></details><details><summary>Revision history ({revisions.length})</summary><div className="mini-list">{revisions.map((item) => <article key={item.id}><strong>Version {item.version}</strong><small>{item.changed_by} · {new Date(item.created_at).toLocaleString()}</small></article>)}</div></details></section>;
}
