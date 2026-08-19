import "server-only";
import { getD1 } from "@/db";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const MAX_BYTES = 8 * 1024 * 1024;

export async function listMediaAssets(limit = 100) {
  const db = await getD1();
  const result = await db.prepare(
    `SELECT id, object_key, filename, content_type, size, alt_text, uploaded_by, created_at
     FROM media_assets ORDER BY id DESC LIMIT ?`,
  ).bind(Math.min(Math.max(limit, 1), 250)).all();
  return result.results.map((row) => ({ ...row, url: `/media/${encodeURIComponent(String(row.object_key))}` }));
}

export async function uploadMedia(file: File, altText: string, uploadedBy: string) {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error("Upload a JPG, PNG, WebP, GIF, or AVIF image.");
  if (!file.size || file.size > MAX_BYTES) throw new Error("Images must be 8 MB or smaller.");
  const extension = extensionFor(file.type);
  const key = `${crypto.randomUUID()}.${extension}`;
  const { env } = await import("cloudflare:workers");
  const bucket = (env as unknown as { MEDIA?: R2Bucket }).MEDIA;
  if (!bucket) throw new Error("The MEDIA object storage binding is unavailable.");
  await bucket.put(key, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { originalName: file.name } });
  const db = await getD1();
  const result = await db.prepare(
    `INSERT INTO media_assets (object_key, filename, content_type, size, alt_text, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(key, file.name.slice(0, 240), file.type, file.size, altText.trim().slice(0, 240), uploadedBy).run();
  return { id: Number(result.meta.last_row_id), objectKey: key, filename: file.name, contentType: file.type, size: file.size, altText: altText.trim(), url: `/media/${encodeURIComponent(key)}` };
}

export async function getMediaObject(key: string) {
  if (!/^[a-f0-9-]+\.(?:jpg|png|webp|gif|avif)$/.test(key)) return null;
  const { env } = await import("cloudflare:workers");
  const bucket = (env as unknown as { MEDIA?: R2Bucket }).MEDIA;
  return bucket ? bucket.get(key) : null;
}

export async function deleteMediaAsset(id: number) {
  const db = await getD1();
  const row = await db.prepare(`SELECT object_key FROM media_assets WHERE id = ?`).bind(id).first<{ object_key: string }>();
  if (!row) return false;
  const reference = await db.prepare(
    `SELECT id FROM blog_posts WHERE deleted_at IS NULL AND content LIKE ? LIMIT 1`,
  ).bind(`%/media/${row.object_key}%`).first<{ id: number }>();
  if (reference) {
    throw new Error(`This image is used by post ${reference.id}. Remove the reference before deleting it.`);
  }
  const { env } = await import("cloudflare:workers");
  const bucket = (env as unknown as { MEDIA?: R2Bucket }).MEDIA;
  if (bucket) await bucket.delete(row.object_key);
  await db.prepare(`DELETE FROM media_assets WHERE id = ?`).bind(id).run();
  return true;
}

function extensionFor(type: string) {
  if (type === "image/jpeg") return "jpg";
  return type.replace("image/", "");
}
