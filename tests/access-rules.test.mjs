import test from "node:test";
import assert from "node:assert/strict";
import { canApprove, canEditPost, canManage, canViewAllPosts, canWrite } from "../lib/access-rules.mjs";

const roles = ["owner", "admin", "editor", "author", "reviewer"];

test("role management matrix permits only owners and administrators", () => {
  assert.deepEqual(roles.filter(canManage), ["owner", "admin"]);
});

test("approval matrix permits reviewers while keeping authors out", () => {
  assert.deepEqual(roles.filter(canApprove), ["owner", "admin", "editor", "reviewer"]);
});

test("reviewers cannot mutate post content", () => {
  assert.equal(canWrite("reviewer"), false);
  assert.equal(canEditPost({ role: "reviewer", email: "reviewer@example.test" }, { authorEmail: "author@example.test" }), false);
});

test("authors can edit only their own posts", () => {
  const author = { role: "author", email: "author@example.test" };
  assert.equal(canViewAllPosts(author.role), false);
  assert.equal(canEditPost(author, { authorEmail: author.email }), true);
  assert.equal(canEditPost(author, { authorEmail: "other@example.test" }), false);
});

test("editors and administrators can edit all posts", () => {
  for (const role of ["owner", "admin", "editor"]) {
    assert.equal(canEditPost({ role, email: `${role}@example.test` }, { authorEmail: "author@example.test" }), true);
  }
});
