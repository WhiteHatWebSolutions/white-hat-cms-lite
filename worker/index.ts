import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MEDIA: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/admin/") && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin) {
        return applySecurityHeaders(new Response(JSON.stringify({ error: "Cross-origin request rejected." }), {
          status: 403, headers: { "content-type": "application/json" },
        }), url);
      }
      const contentLength = Number(request.headers.get("content-length") || 0);
      if (contentLength > 10 * 1024 * 1024) {
        return applySecurityHeaders(new Response(JSON.stringify({ error: "Request body is too large." }), {
          status: 413, headers: { "content-type": "application/json" },
        }), url);
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const imageResponse = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return applySecurityHeaders(imageResponse, url);
    }

    const response = await handler.fetch(request, env, ctx);
    return applySecurityHeaders(response, url);
  },
};

function applySecurityHeaders(response: Response, url: URL) {
    const headers = new Headers(response.headers);
    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "strict-origin-when-cross-origin");
    headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
    headers.set("cross-origin-opener-policy", "same-origin");
    headers.set("content-security-policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https:");
    if (url.protocol === "https:") headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
    if (url.pathname.startsWith("/admin/") || url.pathname.startsWith("/api/admin/")) {
      headers.set("cache-control", "private, no-store, max-age=0");
      headers.set("x-robots-tag", "noindex, nofollow");
    }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default worker;
