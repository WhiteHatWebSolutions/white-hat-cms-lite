import "server-only";
import { siteConfig } from "@/config/site";
import { getD1, getOptionalD1 } from "@/db";
import type { CmsUser } from "@/lib/cms-users";
import { zonedDateTime } from "@/lib/time.mjs";

export const BLOG_STATUSES = ["planned", "draft", "scheduled", "published", "archived"] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];
export type ApprovalStatus = "draft" | "review" | "approved" | "changes_requested";

export type BlogPost = {
  id: number; slug: string; title: string; description: string; purpose: string;
  content: string; category: string; status: BlogStatus; publishDate: string;
  publishTime: string; featured: boolean; seoTitle: string; seoDescription: string;
  authorEmail: string; approvalStatus: ApprovalStatus; approvedBy: string;
  approvedAt: string | null; version: number; deletedAt: string | null;
  createdAt: string; updatedAt: string;
};

export type PublicPost = Pick<BlogPost, "id" | "slug" | "title" | "description" |
  "content" | "category" | "publishDate" | "publishTime" | "featured" |
  "seoTitle" | "seoDescription">;

export type BlogPostInput = {
  slug?: unknown; title?: unknown; description?: unknown; purpose?: unknown;
  content?: unknown; category?: unknown; status?: unknown; publishDate?: unknown;
  publishTime?: unknown; featured?: unknown; seoTitle?: unknown;
  seoDescription?: unknown; version?: unknown;
};

type BlogPostRow = {
  id: number; slug: string; title: string; description: string; purpose: string;
  content: string; category: string; status: string; publish_date: string;
  publish_time: string; featured: number; seo_title: string; seo_description: string;
  author_email: string; approval_status: string; approved_by: string;
  approved_at: string | null; version: number; deleted_at: string | null;
  created_at: string; updated_at: string;
};

type ValidatedBlogPostInput = {
  slug: string; title: string; description: string; purpose: string; content: string;
  category: string; status: BlogStatus; publishDate: string; publishTime: string;
  featured: boolean; seoTitle: string; seoDescription: string;
};

const SELECT_COLUMNS = `id, slug, title, description, purpose, content, category,
  status, publish_date, publish_time, featured, seo_title, seo_description,
  author_email, approval_status, approved_by, approved_at, version, deleted_at,
  created_at, updated_at`;

export async function getPublishedPosts(limit?: number): Promise<PublicPost[]> {
  const db = await getOptionalD1();
  if (!db) return [];
  const { date, time } = configuredDateTime();
  const boundedLimit = Math.min(Math.max(limit ?? 100, 1), 100);
  const result = await db.prepare(
    `SELECT ${SELECT_COLUMNS} FROM blog_posts
     WHERE status IN ('scheduled', 'published') AND approval_status = 'approved'
       AND deleted_at IS NULL
       AND (publish_date < ? OR (publish_date = ? AND publish_time <= ?))
       AND TRIM(description) <> '' AND TRIM(content) <> ''
     ORDER BY featured DESC, publish_date DESC, publish_time DESC, id DESC LIMIT ?`,
  ).bind(date, date, time, boundedLimit).all<BlogPostRow>();
  return result.results.map(toPublicPost);
}

export async function getPublishedPostBySlug(slug: string): Promise<PublicPost | null> {
  const db = await getOptionalD1();
  if (!db) return null;
  const { date, time } = configuredDateTime();
  const row = await db.prepare(
    `SELECT ${SELECT_COLUMNS} FROM blog_posts
     WHERE slug = ? AND status IN ('scheduled', 'published')
       AND approval_status = 'approved' AND deleted_at IS NULL
       AND (publish_date < ? OR (publish_date = ? AND publish_time <= ?))
       AND TRIM(description) <> '' AND TRIM(content) <> '' LIMIT 1`,
  ).bind(slug, date, date, time).first<BlogPostRow>();
  return row ? toPublicPost(row) : null;
}

export async function getAdminPosts(user?: Pick<CmsUser, "email" | "role">): Promise<BlogPost[]> {
  const db = await getD1();
  const authorOnly = user?.role === "author";
  const result = await db.prepare(
    `SELECT ${SELECT_COLUMNS} FROM blog_posts
     WHERE deleted_at IS NULL AND (? = 0 OR author_email = ?)
     ORDER BY publish_date ASC, publish_time ASC, id ASC`,
  ).bind(authorOnly ? 1 : 0, user?.email || "").all<BlogPostRow>();
  return result.results.map(toBlogPost);
}

export async function getAdminPostById(id: number): Promise<BlogPost | null> {
  const db = await getD1();
  const row = await db.prepare(
    `SELECT ${SELECT_COLUMNS} FROM blog_posts WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
  ).bind(id).first<BlogPostRow>();
  return row ? toBlogPost(row) : null;
}

export async function createBlogPost(input: BlogPostInput, actor?: { email: string; canApprove: boolean }): Promise<BlogPost> {
  const post = validateBlogPostInput(input);
  const now = new Date().toISOString();
  const approve = Boolean(actor?.canApprove && isPublicStatus(post.status));
  const db = await getD1();
  const result = await db.prepare(
    `INSERT INTO blog_posts (slug, title, description, purpose, content, category,
      status, publish_date, publish_time, featured, seo_title, seo_description,
      author_email, approval_status, approved_by, approved_at, version, deleted_at,
      created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)`,
  ).bind(post.slug, post.title, post.description, post.purpose, post.content,
    post.category, post.status, post.publishDate, post.publishTime,
    post.featured ? 1 : 0, post.seoTitle, post.seoDescription, actor?.email || "",
    approve ? "approved" : "draft", approve ? actor?.email || "" : "",
    approve ? now : null, now, now).run();
  const created = await getAdminPostById(Number(result.meta.last_row_id));
  if (!created) throw new Error("The new blog post could not be loaded after it was saved.");
  return created;
}

export async function updateBlogPost(id: number, input: BlogPostInput, actor?: { email: string; canApprove: boolean }): Promise<BlogPost | null> {
  const post = validateBlogPostInput(input);
  const expectedVersion = readVersion(input.version);
  const now = new Date().toISOString();
  const approve = Boolean(actor?.canApprove && isPublicStatus(post.status));
  const db = await getD1();
  const result = await db.prepare(
    `UPDATE blog_posts SET slug = ?, title = ?, description = ?, purpose = ?,
       content = ?, category = ?, status = ?, publish_date = ?, publish_time = ?,
       featured = ?, seo_title = ?, seo_description = ?, approval_status = ?,
       approved_by = ?, approved_at = ?, version = version + 1, updated_at = ?
     WHERE id = ? AND version = ? AND deleted_at IS NULL`,
  ).bind(post.slug, post.title, post.description, post.purpose, post.content,
    post.category, post.status, post.publishDate, post.publishTime,
    post.featured ? 1 : 0, post.seoTitle, post.seoDescription,
    approve ? "approved" : "draft", approve ? actor?.email || "" : "",
    approve ? now : null, now, id, expectedVersion).run();
  if (!result.meta.changes) {
    if (await getAdminPostById(id)) throw new BlogConflictError();
    return null;
  }
  return getAdminPostById(id);
}

export async function listDeletedPosts(): Promise<BlogPost[]> {
  const db = await getD1();
  const result = await db.prepare(`SELECT ${SELECT_COLUMNS} FROM blog_posts
    WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`).all<BlogPostRow>();
  return result.results.map(toBlogPost);
}

export async function softDeleteBlogPost(id: number) {
  const db = await getD1();
  const now = new Date().toISOString();
  const result = await db.prepare(`UPDATE blog_posts SET deleted_at = ?, updated_at = ?,
    version = version + 1 WHERE id = ? AND deleted_at IS NULL`).bind(now, now, id).run();
  return Boolean(result.meta.changes);
}

export async function restoreBlogPost(id: number) {
  const db = await getD1();
  const result = await db.prepare(`UPDATE blog_posts SET deleted_at = NULL,
    status = 'draft', approval_status = 'draft', approved_by = '', approved_at = NULL,
    updated_at = ?, version = version + 1 WHERE id = ? AND deleted_at IS NOT NULL`)
    .bind(new Date().toISOString(), id).run();
  return Boolean(result.meta.changes);
}

export function validateBlogPostInput(input: BlogPostInput): ValidatedBlogPostInput {
  const title = readString(input.title, "Title", 160);
  const slug = normalizeSlug(readString(input.slug, "Slug", 180));
  const description = readOptionalString(input.description, 320);
  const purpose = readOptionalString(input.purpose, 1200);
  const content = readOptionalString(input.content, 60000);
  const category = readOptionalString(input.category, 80).trim() || siteConfig.defaultCategory;
  const publishDate = readDate(input.publishDate);
  const publishTime = readTime(input.publishTime);
  const status = readStatus(input.status);
  const seoTitle = readOptionalString(input.seoTitle, 160);
  const seoDescription = readOptionalString(input.seoDescription, 320);
  const featured = input.featured === true;
  if (isPublicStatus(status) && (!description.trim() || !content.trim())) {
    throw new BlogValidationError("A scheduled or published post needs both an excerpt and a finished body.");
  }
  return { title, slug, description, purpose, content, category, publishDate,
    publishTime, status, featured, seoTitle, seoDescription };
}

export class BlogValidationError extends Error {}
export class BlogConflictError extends Error {
  constructor() { super("This post was changed in another session. Reload it before saving again."); }
}

function toBlogPost(row: BlogPostRow): BlogPost {
  return { id: row.id, slug: row.slug, title: row.title, description: row.description,
    purpose: row.purpose, content: row.content, category: row.category,
    status: BLOG_STATUSES.includes(row.status as BlogStatus) ? row.status as BlogStatus : "draft",
    publishDate: row.publish_date, publishTime: row.publish_time || "00:00",
    featured: Boolean(row.featured), seoTitle: row.seo_title, seoDescription: row.seo_description,
    authorEmail: row.author_email, approvalStatus: readApprovalStatus(row.approval_status),
    approvedBy: row.approved_by, approvedAt: row.approved_at, version: row.version,
    deletedAt: row.deleted_at, createdAt: row.created_at, updatedAt: row.updated_at };
}
function toPublicPost(row: BlogPostRow): PublicPost {
  const post = toBlogPost(row);
  return { id: post.id, slug: post.slug, title: post.title, description: post.description,
    content: post.content, category: post.category, publishDate: post.publishDate,
    publishTime: post.publishTime, featured: post.featured, seoTitle: post.seoTitle,
    seoDescription: post.seoDescription };
}
function isPublicStatus(status: BlogStatus) { return status === "scheduled" || status === "published"; }
function readApprovalStatus(value: string): ApprovalStatus {
  return ["draft", "review", "approved", "changes_requested"].includes(value) ? value as ApprovalStatus : "draft";
}
function readString(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim()) throw new BlogValidationError(`${label} is required.`);
  const clean = value.trim();
  if (clean.length > max) throw new BlogValidationError(`${label} must be ${max} characters or fewer.`);
  return clean;
}
function readOptionalString(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  const clean = value.trim();
  if (clean.length > max) throw new BlogValidationError(`This field must be ${max} characters or fewer.`);
  return clean;
}
function readStatus(value: unknown): BlogStatus {
  if (typeof value === "string" && BLOG_STATUSES.includes(value as BlogStatus)) return value as BlogStatus;
  throw new BlogValidationError("Choose a valid publishing status.");
}
function readDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BlogValidationError("Choose a valid publishing date.");
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new BlogValidationError("Choose a valid publishing date.");
  return value;
}
function readTime(value: unknown) {
  const clean = typeof value === "string" ? value : "00:00";
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clean)) throw new BlogValidationError("Choose a valid publishing time.");
  return clean;
}
function readVersion(value: unknown) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) throw new BlogValidationError("Reload this post before saving it.");
  return version;
}
function normalizeSlug(value: string) {
  const slug = value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);
  if (!slug) throw new BlogValidationError("Enter a slug using letters or numbers.");
  return slug;
}
export function configuredDateTime(now = new Date()) {
  return zonedDateTime(now, siteConfig.timeZone);
}
