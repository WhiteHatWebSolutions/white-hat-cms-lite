import "server-only";
import { getD1, getOptionalD1 } from "@/db";
import type { AuthenticatedUser } from "@/app/auth";
import { getBootstrapAdminEmails } from "@/config/admin";
import { canApprove, canEditPost, canManage, canViewAllPosts, canWrite } from "@/lib/access-rules.mjs";

export const CMS_ROLES = ["owner", "admin", "editor", "author", "reviewer"] as const;
export type CmsRole = (typeof CMS_ROLES)[number];

export type CmsUser = AuthenticatedUser & {
  role: CmsRole;
  isBootstrapAdmin: boolean;
};

type CmsUserRow = {
  email: string;
  display_name: string;
  role: string;
  status: string;
};

export async function resolveCmsUser(
  authenticatedUser: AuthenticatedUser | null,
): Promise<CmsUser | null> {
  if (!authenticatedUser) return null;
  const email = authenticatedUser.email.toLowerCase();
  if ((await getBootstrapAdminEmails()).has(email)) {
    return { ...authenticatedUser, email, role: "owner", isBootstrapAdmin: true };
  }

  const db = await getOptionalD1();
  if (!db) return null;
  try {
    const row = await db
      .prepare(
        `SELECT email, display_name, role, status
         FROM cms_users WHERE email = ? LIMIT 1`,
      )
      .bind(email)
      .first<CmsUserRow>();
    if (!row || row.status !== "active" || !isCmsRole(row.role)) return null;
    return {
      ...authenticatedUser,
      email,
      displayName: row.display_name.trim() || authenticatedUser.displayName,
      role: row.role,
      isBootstrapAdmin: false,
    };
  } catch {
    return null;
  }
}

export function roleCanManageUsers(role: CmsRole) {
  return canManage(role);
}

export function roleCanApprove(role: CmsRole) {
  return canApprove(role);
}

export function roleCanWrite(role: CmsRole) {
  return canWrite(role);
}

export function roleCanManageSettings(role: CmsRole) {
  return canManage(role);
}

export const roleCanManageIntegrations = roleCanManageSettings;
export const roleCanManageMedia = roleCanWrite;

export function roleCanViewAllPosts(role: CmsRole) {
  return canViewAllPosts(role);
}

export function roleCanEditPost(
  user: Pick<CmsUser, "email" | "role">,
  post: { authorEmail: string },
) {
  return canEditPost(user, post);
}

export async function listCmsUsers() {
  const db = await getD1();
  const result = await db
    .prepare(
      `SELECT id, email, display_name, role, status, created_at, updated_at
       FROM cms_users ORDER BY email ASC`,
    )
    .all();
  return result.results;
}

export async function upsertCmsUser(input: {
  email: string;
  displayName?: string;
  role: CmsRole;
  status?: "active" | "disabled";
}) {
  const email = input.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address.");
  if (!isCmsRole(input.role)) throw new Error("Choose a valid role.");
  const status = input.status === "disabled" ? "disabled" : "active";
  const db = await getD1();
  await db
    .prepare(
      `INSERT INTO cms_users (email, display_name, role, status, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         display_name = excluded.display_name,
         role = excluded.role,
         status = excluded.status,
         updated_at = excluded.updated_at`,
    )
    .bind(email, (input.displayName || "").trim().slice(0, 100), input.role, status, new Date().toISOString())
    .run();
}

function isCmsRole(value: string): value is CmsRole {
  return CMS_ROLES.includes(value as CmsRole);
}
