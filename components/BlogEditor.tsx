"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { PostContent } from "@/components/PostContent";
import { PostWorkflowPanel } from "@/components/PostWorkflowPanel";
import { siteConfig } from "@/config/site";
import type { BlogPost, BlogStatus } from "@/lib/posts";

type EditorValues = {
  title: string;
  slug: string;
  description: string;
  purpose: string;
  content: string;
  category: string;
  status: BlogStatus;
  publishDate: string;
  publishTime: string;
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
};

const EMPTY_POST: EditorValues = {
  title: "",
  slug: "",
  description: "",
  purpose: "",
  content: "",
  category: siteConfig.defaultCategory,
  status: "planned",
  publishDate: configuredDateString(),
  publishTime: "09:00",
  featured: false,
  seoTitle: "",
  seoDescription: "",
};

const STATUS_OPTIONS: Array<{
  value: BlogStatus;
  label: string;
  description: string;
}> = [
  {
    value: "planned",
    label: "Planned",
    description: "Idea and notes only. Never public.",
  },
  {
    value: "draft",
    label: "Draft",
    description: "Writing is in progress. Never public.",
  },
  {
    value: "scheduled",
    label: "Scheduled",
    description: "Publishes automatically on the selected date.",
  },
  {
    value: "published",
    label: "Published",
    description: "Visible when the selected date has arrived.",
  },
  {
    value: "archived",
    label: "Archived",
    description: "Retained privately and hidden from the site.",
  },
];

export function BlogEditor({ post, canWrite = true, canApprove = false }: { post?: BlogPost; canWrite?: boolean; canApprove?: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState<EditorValues>(
    post
      ? {
          title: post.title,
          slug: post.slug,
          description: post.description,
          purpose: post.purpose,
          content: post.content,
          category: post.category,
          status: post.status,
          publishDate: post.publishDate,
          publishTime: post.publishTime,
          featured: post.featured,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
        }
      : EMPTY_POST,
  );
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [currentVersion, setCurrentVersion] = useState(post?.version);
  const [aiBrief, setAiBrief] = useState("");
  const [aiState, setAiState] = useState<"idle" | "working" | "error">("idle");
  const [aiMessage, setAiMessage] = useState("");

  const selectedStatus = useMemo(
    () =>
      STATUS_OPTIONS.find((option) => option.value === values.status) ??
      STATUS_OPTIONS[0],
    [values.status],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState("saving");
    setMessage("");

    try {
      const response = await fetch(
        post ? `/api/admin/posts/${post.id}` : "/api/admin/posts",
        {
          method: post ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...values, version: currentVersion }),
        },
      );

      const result = (await response.json()) as {
        error?: string;
        post?: BlogPost;
      };

      if (!response.ok || !result.post) {
        throw new Error(result.error || "The post could not be saved.");
      }

      setSaveState("saved");
      setMessage("Saved.");
      setCurrentVersion(result.post.version);

      if (!post) {
        router.replace(`/admin/blog/${result.post.id}/`);
      } else {
        router.refresh();
      }
    } catch (error) {
      setSaveState("error");
      setMessage(
        error instanceof Error ? error.message : "The post could not be saved.",
      );
    }
  }

  function update<K extends keyof EditorValues>(
    key: K,
    value: EditorValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
    setMessage("");
  }

  function handleTitleChange(title: string) {
    const shouldUpdateSlug =
      !values.slug || values.slug === slugify(values.title);
    setValues((current) => ({
      ...current,
      title,
      slug: shouldUpdateSlug ? slugify(title) : current.slug,
    }));
    setSaveState("idle");
    setMessage("");
  }

  async function generateDraft() {
    if (!aiBrief.trim()) { setAiState("error"); setAiMessage("Describe the post you want to draft."); return; }
    setAiState("working"); setAiMessage("Creating a draft...");
    try {
      const response = await fetch("/api/admin/ai/generate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief: aiBrief, title: values.title, purpose: values.purpose, category: values.category, targetLength: 900 }),
      });
      const result = await response.json() as { error?: string; draft?: Partial<EditorValues> };
      if (!response.ok || !result.draft) throw new Error(result.error || "The draft could not be generated.");
      setValues((current) => ({ ...current, ...result.draft, status: "draft" }));
      setAiState("idle"); setAiMessage("Draft added to the editor. Review every field before publishing.");
    } catch (error) {
      setAiState("error"); setAiMessage(error instanceof Error ? error.message : "The draft could not be generated.");
    }
  }

  async function trashPost() {
    if (!post || !window.confirm("Move this post to trash?")) return;
    const response = await fetch(`/api/admin/posts/${post.id}`, { method: "DELETE" });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setMessage(result.error || "The post could not be moved to trash."); return; }
    router.replace("/admin/blog/");
  }

  function wrapSelection(prefix: string, suffix = prefix) {
    const field = document.getElementById("post-content") as HTMLTextAreaElement | null;
    if (!field) return;
    const start = field.selectionStart; const end = field.selectionEnd;
    const selected = values.content.slice(start, end) || "text";
    update("content", `${values.content.slice(0, start)}${prefix}${selected}${suffix}${values.content.slice(end)}`);
  }

  return (
    <form className="blog-editor" onSubmit={handleSubmit}>
      <div className="editor-toolbar">
        <Link className="admin-text-link" href="/admin/blog/">
          Back to calendar
        </Link>
        <div className="editor-save-actions">
          <span
            className={`save-message ${saveState === "error" ? "is-error" : ""}`}
            aria-live="polite"
          >
            {saveState === "saving" ? "Saving..." : message}
          </span>
          {canWrite && post ? <button className="btn btn-secondary" type="button" onClick={() => void trashPost()}>Move to trash</button> : null}
          {canWrite ? <button
            className="btn btn-primary"
            type="submit"
            disabled={saveState === "saving"}
          >
            {saveState === "saving" ? "Saving" : "Save post"}
          </button> : <span>Read-only review</span>}
        </div>
      </div>

      <div className="editor-grid">
        <div className="editor-main">
          <section className="admin-panel">
            {canWrite ? <div className="ai-draft-panel">
              <div><p className="admin-kicker">AI writing assistant</p><h2>Create a review-ready draft</h2></div>
              <textarea value={aiBrief} onChange={(event) => setAiBrief(event.target.value)} rows={4} maxLength={4000} placeholder="Describe the topic, goal, key facts, audience, and call to action." />
              <div className="form-actions"><span className={aiState === "error" ? "is-error" : ""}>{aiMessage}</span><button className="btn btn-secondary" type="button" disabled={aiState === "working"} onClick={() => void generateDraft()}>{aiState === "working" ? "Drafting..." : "Generate draft"}</button></div>
            </div> : null}
            <div className="field-group">
              <label htmlFor="post-title">Title</label>
              <input
                id="post-title"
                value={values.title}
                onChange={(event) => handleTitleChange(event.target.value)}
                maxLength={160}
                required
              />
            </div>

            <div className="field-group">
              <label htmlFor="post-slug">URL slug</label>
              <div className="slug-field">
                <span>/blog/</span>
                <input
                  id="post-slug"
                  value={values.slug}
                  onChange={(event) => update("slug", event.target.value)}
                  maxLength={180}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="post-purpose">
                Private purpose and direction
              </label>
              <textarea
                id="post-purpose"
                value={values.purpose}
                onChange={(event) => update("purpose", event.target.value)}
                rows={4}
                maxLength={1200}
              />
              <small>
                These notes are visible only inside the publishing desk.
              </small>
            </div>

            <div className="field-group">
              <label htmlFor="post-description">Public excerpt</label>
              <textarea
                id="post-description"
                value={values.description}
                onChange={(event) => update("description", event.target.value)}
                rows={3}
                maxLength={320}
              />
              <small>
                This appears on the blog card and beneath the article title.
              </small>
            </div>

            <div className="field-group">
              <label htmlFor="post-content">Article body</label>
              <div className="format-toolbar" aria-label="Formatting tools">
                <button type="button" onClick={() => wrapSelection("## ", "")}>H2</button><button type="button" onClick={() => wrapSelection("### ", "")}>H3</button><button type="button" onClick={() => wrapSelection("**")}>Bold</button><button type="button" onClick={() => wrapSelection("[", "](https://)")}>Link</button><button type="button" onClick={() => wrapSelection("![Alt text](", ")")}>Image</button><button type="button" onClick={() => wrapSelection("- ", "")}>List</button><button type="button" onClick={() => wrapSelection("> ", "")}>Quote</button>
              </div>
              <textarea
                id="post-content"
                className="content-editor"
                value={values.content}
                onChange={(event) => update("content", event.target.value)}
                rows={24}
                maxLength={60000}
                placeholder="Write the article here..."
              />
              <small>
                Separate paragraphs with a blank line. Use ## for a section
                heading, ### for a smaller heading, - for a list, and &gt; for a
                quotation.
              </small>
            </div>
          </section>

          <section className="admin-panel editor-preview">
            <p className="admin-kicker">Article preview</p>
            <span className="tag">
              {values.category || siteConfig.defaultCategory}
            </span>
            <h1>{values.title || "Untitled post"}</h1>
            {values.description ? (
              <p className="article-description">{values.description}</p>
            ) : (
              <p className="article-description preview-placeholder">
                The public excerpt will appear here.
              </p>
            )}
            {values.content ? (
              <PostContent content={values.content} />
            ) : (
              <div className="article-content preview-placeholder">
                The article preview will appear as you write.
              </div>
            )}
          </section>
        </div>

        <aside className="editor-sidebar">
          {post ? <PostWorkflowPanel postId={post.id} approvalStatus={post.approvalStatus} canApprove={canApprove} canRequestReview={canWrite} /> : null}
          <section className="admin-panel">
            <div className="field-group">
              <label htmlFor="post-status">Publishing status</label>
              <select
                id="post-status"
                value={values.status}
                onChange={(event) =>
                  update("status", event.target.value as BlogStatus)
                }
                disabled={!canWrite}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small>{selectedStatus.description}</small>
            </div>

            <div className="field-group">
              <label htmlFor="post-date">Publishing date</label>
              <input
                id="post-date"
                type="date"
                value={values.publishDate}
                onChange={(event) => update("publishDate", event.target.value)}
                required
                disabled={!canWrite}
              />
              <small>
                Scheduled posts use this date and the time below.
              </small>
            </div>

            <div className="field-group">
              <label htmlFor="post-time">Publishing time</label>
              <input
                id="post-time"
                type="time"
                value={values.publishTime}
                onChange={(event) => update("publishTime", event.target.value)}
                required
                disabled={!canWrite}
              />
              <small>Uses the publication time zone configured by the application.</small>
            </div>

            <div className="field-group">
              <label htmlFor="post-category">Category</label>
              <input
                id="post-category"
                value={values.category}
                onChange={(event) => update("category", event.target.value)}
                maxLength={80}
              />
            </div>

            <label className="checkbox-field" htmlFor="post-featured">
              <input
                id="post-featured"
                type="checkbox"
                checked={values.featured}
                onChange={(event) => update("featured", event.target.checked)}
              />
              <span>
                <strong>Featured post</strong>
                <small>Prioritize this article in public listings.</small>
              </span>
            </label>
          </section>

          <section className="admin-panel">
            <p className="admin-kicker">Search and sharing</p>
            <div className="field-group">
              <label htmlFor="post-seo-title">SEO title</label>
              <input
                id="post-seo-title"
                value={values.seoTitle}
                onChange={(event) => update("seoTitle", event.target.value)}
                maxLength={160}
                placeholder="Defaults to the article title"
              />
            </div>
            <div className="field-group">
              <label htmlFor="post-seo-description">SEO description</label>
              <textarea
                id="post-seo-description"
                value={values.seoDescription}
                onChange={(event) =>
                  update("seoDescription", event.target.value)
                }
                rows={4}
                maxLength={320}
                placeholder="Defaults to the public excerpt"
              />
            </div>
          </section>
        </aside>
      </div>
    </form>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function configuredDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: siteConfig.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
