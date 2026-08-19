import "server-only";
import { getD1 } from "@/db";

export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Too many requests. Try again later.");
  }
}

export async function enforceRateLimit(input: {
  scope: string;
  identity: string;
  limit: number;
  windowSeconds: number;
}) {
  const now = new Date();
  const bucket = `${input.scope}:${input.identity.toLowerCase()}`;
  const db = await getD1();
  const nowIso = now.toISOString();
  const resetAt = new Date(now.valueOf() + input.windowSeconds * 1000).toISOString();
  const current = await db.prepare(
    `INSERT INTO rate_limits (bucket, count, reset_at) VALUES (?, 1, ?)
     ON CONFLICT(bucket) DO UPDATE SET
       count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
       reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END
     RETURNING count, reset_at`,
  ).bind(bucket, resetAt, nowIso, nowIso).first<{ count: number; reset_at: string }>();
  if (current && current.count > input.limit) {
    throw new RateLimitError(Math.max(1, Math.ceil((Date.parse(current.reset_at) - now.valueOf()) / 1000)));
  }
}

export function rateLimitResponse(error: RateLimitError) {
  return new Response(JSON.stringify({ error: error.message }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      "retry-after": String(error.retryAfterSeconds),
    },
  });
}
