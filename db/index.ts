export async function getD1() {
  const { env } = await import("cloudflare:workers");

  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let the platform inject the database binding before using the blog CMS.",
    );
  }

  return env.DB;
}

export async function getOptionalD1() {
  const { env } = await import("cloudflare:workers");
  return env.DB ?? null;
}
