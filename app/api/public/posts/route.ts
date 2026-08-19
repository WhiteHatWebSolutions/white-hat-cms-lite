import { NextResponse } from "next/server";
import { getPublishedPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export async function GET() {
  return publicResponse({ posts: await getPublishedPosts() });
}

export function OPTIONS() {
  return new Response(null, { headers: publicHeaders() });
}

function publicResponse(body: unknown) {
  return NextResponse.json(body, { headers: publicHeaders() });
}

function publicHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
  };
}
