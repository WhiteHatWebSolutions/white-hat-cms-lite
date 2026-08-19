import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const read = (path) => readFileSync(path, "utf8");

test("worker applies baseline browser security headers and disables admin caching", () => {
  const worker = read("worker/index.ts");
  for (const header of ["content-security-policy", "x-content-type-options", "strict-transport-security",
    "referrer-policy", "permissions-policy", "cross-origin-opener-policy", "cache-control", "x-robots-tag"]) {
    assert.match(worker, new RegExp(header));
  }
});

test("worker rejects cross-origin administrative mutations and oversized bodies", () => {
  const worker = read("worker/index.ts");
  assert.match(worker, /origin !== url\.origin/);
  assert.match(worker, /Cross-origin request rejected/);
  assert.match(worker, /10 \* 1024 \* 1024/);
  assert.match(worker, /status: 413/);
});

test("approval gates every distribution path", () => {
  assert.match(read("lib/integrations.ts"), /post\.approvalStatus !== "approved"/);
  assert.match(read("lib/publishing-connectors.ts"), /post\.approvalStatus !== "approved"/);
  assert.match(read("lib/publishing-connectors.ts"), /payload\.post\.approvalStatus !== "approved"/);
  assert.match(read("app/api/admin/posts/route.ts"), /approvalStatus !== "approved"/);
  assert.match(read("app/api/admin/posts/\[id\]/route.ts"), /approvalStatus === "approved"/);
});

test("distribution payloads exclude private editorial purpose and author identity", () => {
  const connectors = read("lib/publishing-connectors.ts");
  const projection = connectors.slice(connectors.indexOf("export function toDistributionPost"));
  assert.doesNotMatch(projection, /purpose:/);
  assert.doesNotMatch(projection, /authorEmail:/);
  assert.match(read("lib/integrations.ts"), /toDistributionPost\(post\)/);
});

test("sensitive administrative mutations perform role checks", () => {
  assert.match(read("app/api/admin/settings/route.ts"), /roleCanManageSettings/);
  assert.match(read("app/api/admin/restore/route.ts"), /user\.role !== "owner"/);
  assert.match(read("app/api/admin/integrations/route.ts"), /roleCanManageUsers/);
  assert.match(read("app/api/admin/posts/\[id\]/route.ts"), /roleCanEditPost/);
});

test("AI and media endpoints enforce persistent rate limits", () => {
  assert.match(read("app/api/admin/ai/generate/route.ts"), /enforceRateLimit/);
  assert.match(read("app/api/admin/media/route.ts"), /enforceRateLimit/);
  assert.match(read("lib/rate-limit.ts"), /rate_limits/);
});

test("AI endpoint safety blocks private network targets", () => {
  const contract = read("lib/connector-contract.mjs");
  assert.match(contract, /localhost/);
  assert.match(contract, /nums\[0\] === 192/);
  assert.match(contract, /nums\[0\] === 172/);
  assert.match(contract, /public HTTPS URL/);
});

test("connector credentials are encrypted, redacted, and never selected by public list output", () => {
  const connectors = read("lib/publishing-connectors.ts");
  assert.match(connectors, /encryptSecret/);
  assert.match(connectors, /connected: Boolean\(row\.secret_ciphertext\)/);
  assert.doesNotMatch(connectors, /secretCiphertext:/);
  assert.match(read("lib/backup.ts"), /secret_ciphertext: "\[REDACTED\]"/);
});

test("connector mutations require integration-manager access and persistent rate limits", () => {
  for (const route of ["app/api/admin/connectors/route.ts", "app/api/admin/connectors/[id]/route.ts", "app/api/admin/connectors/[id]/test/route.ts"]) {
    assert.match(read(route), /roleCanManageIntegrations/);
    assert.match(read(route), /enforceRateLimit/);
  }
});

test("outbound connector requests reject redirects and enforce timeouts", () => {
  const connectors = read("lib/publishing-connectors.ts");
  assert.match(connectors, /redirect: "error"/);
  assert.match(connectors, /AbortSignal\.timeout\(20000\)/);
  assert.match(connectors, /response was too large/);
});

test("WordPress connector has valid PHP syntax when PHP is installed", (context) => {
  try {
    const output = execFileSync("php", ["-l", "public/integrations/wordpress/white-hat-cms-lite.php"], { encoding: "utf8" });
    assert.match(output, /No syntax errors detected/);
  } catch (error) {
    if (error?.code === "ENOENT") context.skip("PHP is not installed in this test environment.");
    else throw error;
  }
});

test("WordPress export preserves scheduled posts as future posts", () => {
  assert.match(read("app/api/admin/export/wordpress/route.ts"), /"future"/);
  assert.match(read("app/api/admin/export/wordpress/route.ts"), /wp:post_date/);
});

test("backups are checksummed, redacted, and require explicit owner confirmation", () => {
  const backup = read("lib/backup.ts");
  assert.match(backup, /SHA-256/);
  assert.match(backup, /\[REDACTED\]/);
  assert.match(read("app/api/admin/restore/route.ts"), /confirmation !== "RESTORE"/);
});

test("theme packages are versioned and validated", () => {
  const route = read("app/api/admin/theme-package/route.ts");
  assert.match(route, /white-hat-cms-lite-theme/);
  assert.match(route, /version !== 1/);
  assert.match(route, /roleCanManageSettings/);
});

test("custom CSS and theme asset URLs reject active or local resource loading", () => {
  const settings = read("lib/site-settings.ts");
  assert.match(settings, /@import\|url/);
  assert.match(settings, /javascript/);
  assert.match(settings, /assertPublicHttpsUrl/);
});
