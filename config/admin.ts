import "server-only";

export async function getBootstrapAdminEmails() {
  let configured = process.env.CMS_ADMIN_EMAILS || "";
  try {
    const { env } = await import("cloudflare:workers");
    configured = (env as unknown as { CMS_ADMIN_EMAILS?: string }).CMS_ADMIN_EMAILS || configured;
  } catch {
    // The worker environment is unavailable during static build analysis.
  }
  return new Set(configured.split(",").map((email) => email.trim().toLowerCase()).filter((email) => /^\S+@\S+\.\S+$/.test(email)));
}
