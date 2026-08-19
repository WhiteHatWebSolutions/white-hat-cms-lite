import test from "node:test";
import assert from "node:assert/strict";
import {
  CONNECTOR_PROVIDERS, assertPublicHttpsUrl, buildConnectorRequest,
  markdownToHtml, normalizeConnectorInput, providerIds,
} from "../lib/connector-contract.mjs";

const post = { id: 42, version: 3, title: "Safe publishing", slug: "safe-publishing",
  description: "A complete summary.", content: "## Heading\n\nBody with **detail**.", category: "Guides",
  seoTitle: "Safe publishing guide", seoDescription: "A complete SEO summary." };

const configs = {
  ghost: { baseUrl: "https://ghost.example.com" },
  webflow: { collectionId: "abc123", titleField: "name", slugField: "slug", bodyField: "body", summaryField: "summary" },
  contentful: { spaceId: "space1", environmentId: "master", contentTypeId: "post", locale: "en-US", titleField: "title", slugField: "slug", bodyField: "body", bodyFormat: "text", descriptionField: "description" },
  sanity: { projectId: "project1", dataset: "production", documentType: "post", titleField: "title", slugField: "slug", bodyField: "body", excerptField: "excerpt" },
  strapi: { baseUrl: "https://strapi.example.com", collectionPath: "api/articles", titleField: "title", slugField: "slug", bodyField: "content", descriptionField: "description" },
  hubspot: { blogId: "123", authorId: "456" },
  shopify: { shopDomain: "store.myshopify.com", blogId: "gid://shopify/Blog/123" },
  drupal: { baseUrl: "https://drupal.example.com", contentType: "article", bodyFormat: "basic_html" },
  webhook: { endpoint: "https://hooks.example.com/cms" },
};

test("every advertised platform builds an HTTPS publishing request", () => {
  assert.deepEqual(providerIds().sort(), Object.keys(configs).sort());
  for (const provider of providerIds()) {
    const request = buildConnectorRequest(provider, configs[provider], "credential", post, "published", "publish");
    assert.equal(new URL(request.url).protocol, "https:");
    assert.equal(request.method === "POST" || request.method === "PUT", true);
    assert.ok(request.body);
  }
});

test("scheduled events never publish early", () => {
  for (const provider of providerIds()) {
    const request = buildConnectorRequest(provider, configs[provider], "credential", post, "scheduled", "publish");
    const body = JSON.parse(request.body);
    if (provider === "ghost") assert.equal(body.posts[0].status, "draft");
    if (provider === "webflow") assert.equal(body.isDraft, true);
    if (provider === "sanity") assert.match(body.mutations[0].createOrReplace._id, /^drafts\./);
    if (provider === "hubspot") assert.equal(body.state, "DRAFT");
    if (provider === "shopify") assert.equal(body.variables.article.isPublished, false);
    if (provider === "drupal") assert.equal(body.data.attributes.status, false);
    if (provider === "webhook") assert.equal(body.publish, false);
  }
});

test("connector input accepts only declared fields and never stores a secret in config", () => {
  const input = normalizeConnectorInput({ provider: "ghost", name: "Editorial Ghost", config: configs.ghost,
    enabled: true, deliveryMode: "publish", secret: "must-not-be-copied", unexpected: "discard" });
  assert.deepEqual(input.config, configs.ghost);
  assert.equal("secret" in input, false);
  assert.equal("unexpected" in input.config, false);
});

test("public URL validation blocks local, private, credentialed, and non-HTTPS targets", () => {
  for (const value of ["http://example.com", "https://localhost/hook", "https://127.0.0.1/hook",
    "https://10.1.2.3/hook", "https://169.254.169.254/latest", "https://[::1]/hook",
    "https://user:pass@example.com/hook", "https://service.internal/hook"]) {
    assert.throws(() => assertPublicHttpsUrl(value), /public HTTPS URL/);
  }
  assert.equal(assertPublicHttpsUrl("https://example.com/hook"), "https://example.com/hook");
});

test("Markdown conversion escapes raw HTML before adding supported formatting", () => {
  const html = markdownToHtml("## Title\n\n<script>alert(1)</script>\n\n**Safe**");
  assert.match(html, /<h2>Title<\/h2>/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<strong>Safe<\/strong>/);
});

test("platform registry exposes labels, credential names, and setup fields", () => {
  for (const definition of Object.values(CONNECTOR_PROVIDERS)) {
    assert.ok(definition.label);
    assert.ok(definition.secretLabel);
    assert.ok(definition.fields.length);
  }
});

test("Contentful rich-text and Sanity portable-text payloads use native document shapes", () => {
  const contentful = buildConnectorRequest("contentful", { ...configs.contentful, bodyFormat: "rich-text" }, "token", post, "scheduled", "draft");
  assert.equal(JSON.parse(contentful.body).fields.body["en-US"].nodeType, "document");
  const sanity = buildConnectorRequest("sanity", configs.sanity, "token", post, "scheduled", "draft");
  assert.equal(JSON.parse(sanity.body).mutations[0].createOrReplace.body[0]._type, "block");
});
