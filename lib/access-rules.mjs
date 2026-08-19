const privileged = new Set(["owner", "admin"]);

export function canManage(role) { return privileged.has(role); }
export function canApprove(role) { return privileged.has(role) || role === "editor" || role === "reviewer"; }
export function canWrite(role) { return role !== "reviewer"; }
export function canViewAllPosts(role) { return role !== "author"; }
export function canEditPost(user, post) {
  return canWrite(user.role) && (canViewAllPosts(user.role) || post.authorEmail === user.email);
}
