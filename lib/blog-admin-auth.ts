import { notFound } from "next/navigation";
import {
  getAuthenticatedUser,
  requireAuthenticatedUser,
} from "@/app/auth";
import { resolveCmsUser, type CmsRole } from "@/lib/cms-users";

export async function getBlogAdmin() {
  const user = await getAuthenticatedUser();
  return resolveCmsUser(user);
}

export async function requireBlogAdmin(returnTo: string) {
  const user = await requireAuthenticatedUser(returnTo);
  const cmsUser = await resolveCmsUser(user);
  if (!cmsUser) {
    notFound();
  }
  return cmsUser;
}

export async function requireCmsRole(returnTo: string, roles: CmsRole[]) {
  const user = await requireBlogAdmin(returnTo);
  if (!roles.includes(user.role)) notFound();
  return user;
}
