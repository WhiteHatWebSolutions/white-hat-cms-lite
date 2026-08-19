export const CONNECTOR_PROVIDERS = {
  ghost: {
    label: "Ghost",
    secretLabel: "Admin API key",
    fields: [field("baseUrl", "Site URL", "url", "https://publication.example")],
  },
  webflow: {
    label: "Webflow CMS",
    secretLabel: "API token",
    fields: [
      field("collectionId", "Collection ID"),
      field("titleField", "Title field", "text", "name"),
      field("slugField", "Slug field", "text", "slug"),
      field("bodyField", "Body field", "text", "post-body"),
      field("summaryField", "Summary field", "text", "post-summary"),
    ],
  },
  contentful: {
    label: "Contentful",
    secretLabel: "Management token",
    fields: [
      field("spaceId", "Space ID"), field("environmentId", "Environment ID", "text", "master"),
      field("contentTypeId", "Content type ID"), field("locale", "Locale", "text", "en-US"),
      field("titleField", "Title field", "text", "title"), field("slugField", "Slug field", "text", "slug"),
      field("bodyField", "Body field", "text", "body"), field("bodyFormat", "Body format: text or rich-text", "text", "text"),
      field("descriptionField", "Description field", "text", "description"),
    ],
  },
  sanity: {
    label: "Sanity",
    secretLabel: "Write token",
    fields: [field("projectId", "Project ID"), field("dataset", "Dataset", "text", "production"), field("documentType", "Document type", "text", "post"),
      field("titleField", "Title field", "text", "title"), field("slugField", "Slug field", "text", "slug"),
      field("bodyField", "Body field", "text", "body"), field("excerptField", "Excerpt field", "text", "excerpt")],
  },
  strapi: {
    label: "Strapi",
    secretLabel: "API token",
    fields: [
      field("baseUrl", "Server URL", "url", "https://cms.example"), field("collectionPath", "Collection path", "text", "api/articles"),
      field("titleField", "Title field", "text", "title"), field("slugField", "Slug field", "text", "slug"),
      field("bodyField", "Body field", "text", "content"), field("descriptionField", "Description field", "text", "description"),
    ],
  },
  hubspot: {
    label: "HubSpot CMS",
    secretLabel: "Private app token",
    fields: [field("blogId", "Blog ID"), field("authorId", "Blog author ID")],
  },
  shopify: {
    label: "Shopify Blog",
    secretLabel: "Admin API access token",
    fields: [field("shopDomain", "Shop domain", "text", "store.myshopify.com"), field("blogId", "Blog GraphQL ID", "text", "gid://shopify/Blog/123")],
  },
  drupal: {
    label: "Drupal JSON:API",
    secretLabel: "Bearer token",
    fields: [field("baseUrl", "Site URL", "url", "https://cms.example"), field("contentType", "Content type machine name", "text", "article"), field("bodyFormat", "Body text format", "text", "basic_html")],
  },
  webhook: {
    label: "Automation webhook",
    secretLabel: "Signing secret",
    fields: [field("endpoint", "Webhook URL", "url", "https://hooks.example/white-hat-cms-lite")],
  },
};

export function providerIds() {
  return Object.keys(CONNECTOR_PROVIDERS);
}

export function normalizeConnectorInput(input, current = null) {
  if (!input || typeof input !== "object") throw new Error("Send valid connector settings.");
  const provider = String(input.provider || current?.provider || "");
  const definition = CONNECTOR_PROVIDERS[provider];
  if (!definition) throw new Error("Choose a supported publishing platform.");
  const name = cleanText(input.name ?? current?.name ?? definition.label, 100);
  if (!name) throw new Error("Enter a connector name.");
  const suppliedConfig = input.config && typeof input.config === "object" ? input.config : {};
  const config = {};
  for (const descriptor of definition.fields) {
    const prior = current?.config?.[descriptor.key] || descriptor.placeholder || "";
    const value = cleanText(suppliedConfig[descriptor.key] ?? prior, descriptor.type === "url" ? 500 : 160);
    if (!value) throw new Error(`${descriptor.label} is required.`);
    config[descriptor.key] = descriptor.type === "url" ? assertPublicHttpsUrl(value, descriptor.label) : value;
  }
  validateProviderConfig(provider, config);
  return {
    provider, name, config,
    enabled: input.enabled === undefined ? current?.enabled !== false : input.enabled === true,
    deliveryMode: input.deliveryMode === "publish" || (input.deliveryMode === undefined && current?.deliveryMode === "publish") ? "publish" : "draft",
  };
}

export function buildConnectorRequest(provider, config, credential, post, event, deliveryMode) {
  if (!CONNECTOR_PROVIDERS[provider]) throw new Error("Unsupported publishing platform.");
  const publish = deliveryMode === "publish" && event === "published";
  const html = markdownToHtml(post.content || "");
  const headers = { "content-type": "application/json", accept: "application/json" };
  if (provider === "ghost") {
    return request(`${trimSlash(config.baseUrl)}/ghost/api/admin/posts/?source=html`, headers,
      { posts: [{ title: post.title, slug: post.slug, custom_excerpt: post.description, html, status: publish ? "published" : "draft" }] },
      { authorization: `Ghost ${credential}` });
  }
  if (provider === "webflow") {
    const fields = { [config.titleField]: post.title, [config.slugField]: post.slug, [config.bodyField]: html, [config.summaryField]: post.description };
    return request(`https://api.webflow.com/v2/collections/${encodeURIComponent(config.collectionId)}/items${publish ? "/live" : ""}`,
      headers, { isArchived: false, isDraft: !publish, fieldData: fields }, { authorization: `Bearer ${credential}` });
  }
  if (provider === "contentful") {
    const entryId = deterministicExternalId(post);
    const localized = (value) => ({ [config.locale]: value });
    const body = config.bodyFormat === "rich-text" ? contentfulRichText(post.content) : post.content;
    const fields = { [config.titleField]: localized(post.title), [config.slugField]: localized(post.slug), [config.bodyField]: localized(body), [config.descriptionField]: localized(post.description) };
    return request(`https://api.contentful.com/spaces/${encodeURIComponent(config.spaceId)}/environments/${encodeURIComponent(config.environmentId)}/entries/${entryId}`,
      { ...headers, "content-type": "application/vnd.contentful.management.v1+json", "x-contentful-content-type": config.contentTypeId }, { fields }, { authorization: `Bearer ${credential}` }, { publish, entryId, method: "PUT" });
  }
  if (provider === "sanity") {
    const baseId = deterministicExternalId(post);
    const id = publish ? baseId : `drafts.${baseId}`;
    const document = { _id: id, _type: config.documentType, [config.titleField]: post.title,
      [config.slugField]: { _type: "slug", current: post.slug }, [config.excerptField]: post.description,
      [config.bodyField]: sanityPortableText(post.content), cmsSourceId: String(post.id) };
    return request(`https://${config.projectId}.api.sanity.io/v2025-02-19/data/mutate/${encodeURIComponent(config.dataset)}?returnIds=true`, headers,
      { mutations: [{ createOrReplace: document }] }, { authorization: `Bearer ${credential}` }, { entryId: id });
  }
  if (provider === "strapi") {
    const data = { [config.titleField]: post.title, [config.slugField]: post.slug, [config.bodyField]: post.content, [config.descriptionField]: post.description };
    return request(`${trimSlash(config.baseUrl)}/${trimPath(config.collectionPath)}?status=${publish ? "published" : "draft"}`, headers, { data }, { authorization: `Bearer ${credential}` });
  }
  if (provider === "hubspot") {
    return request("https://api.hubapi.com/cms/blogs/2026-03/posts", headers, {
      name: post.title, htmlTitle: post.seoTitle || post.title, contentGroupId: config.blogId,
      blogAuthorId: config.authorId, slug: post.slug, metaDescription: post.seoDescription || post.description,
      postSummary: post.description, postBody: html, useFeaturedImage: false, state: publish ? "PUBLISHED" : "DRAFT",
    }, { authorization: `Bearer ${credential}` });
  }
  if (provider === "shopify") {
    const query = "mutation CreateArticle($article: ArticleCreateInput!) { articleCreate(article: $article) { article { id handle title isPublished } userErrors { field message } } }";
    return request(`https://${config.shopDomain}/admin/api/2026-07/graphql.json`, headers, { query, variables: { article: {
      blogId: config.blogId, title: post.title, handle: post.slug, body: html, summary: post.description,
      isPublished: publish, tags: post.category ? [post.category] : [],
    } } }, { "x-shopify-access-token": credential });
  }
  if (provider === "drupal") {
    return request(`${trimSlash(config.baseUrl)}/jsonapi/node/${encodeURIComponent(config.contentType)}`,
      { ...headers, accept: "application/vnd.api+json", "content-type": "application/vnd.api+json" }, {
        data: { type: `node--${config.contentType}`, attributes: { title: post.title, body: { value: html, format: config.bodyFormat }, status: publish } },
      }, { authorization: `Bearer ${credential}` });
  }
  const payload = { source: "white-hat-cms-lite", event, deliveryMode, publish, post };
  return request(config.endpoint, headers, payload, {}, { signBody: true });
}

export function buildConnectionTestRequest(provider, config, credential) {
  const headers = { accept: "application/json" };
  if (provider === "ghost") return { url: `${trimSlash(config.baseUrl)}/ghost/api/admin/site/`, method: "GET", headers: { ...headers, authorization: `Ghost ${credential}` } };
  if (provider === "webflow") return { url: `https://api.webflow.com/v2/collections/${encodeURIComponent(config.collectionId)}`, method: "GET", headers: { ...headers, authorization: `Bearer ${credential}` } };
  if (provider === "contentful") return { url: `https://api.contentful.com/spaces/${encodeURIComponent(config.spaceId)}/environments/${encodeURIComponent(config.environmentId)}`, method: "GET", headers: { ...headers, authorization: `Bearer ${credential}` } };
  if (provider === "sanity") return { url: `https://${config.projectId}.api.sanity.io/v2025-02-19/data/query/${encodeURIComponent(config.dataset)}?query=${encodeURIComponent("count(*[0...1])")}`, method: "GET", headers: { ...headers, authorization: `Bearer ${credential}` } };
  if (provider === "strapi") return { url: `${trimSlash(config.baseUrl)}/${trimPath(config.collectionPath)}?pagination[pageSize]=1`, method: "GET", headers: { ...headers, authorization: `Bearer ${credential}` } };
  if (provider === "hubspot") return { url: "https://api.hubapi.com/cms/blogs/2026-03/posts?limit=1", method: "GET", headers: { ...headers, authorization: `Bearer ${credential}` } };
  if (provider === "shopify") return request(`https://${config.shopDomain}/admin/api/2026-07/graphql.json`, { ...headers, "content-type": "application/json" }, { query: "{ shop { name } }" }, { "x-shopify-access-token": credential });
  if (provider === "drupal") return { url: `${trimSlash(config.baseUrl)}/jsonapi/node/${encodeURIComponent(config.contentType)}?page[limit]=1`, method: "GET", headers: { ...headers, authorization: `Bearer ${credential}` } };
  return request(config.endpoint, { ...headers, "content-type": "application/json" }, { source: "white-hat-cms-lite", event: "connection.test", sentAt: new Date().toISOString() }, {}, { signBody: true });
}

export function assertPublicHttpsUrl(value, label = "URL") {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} must be a valid public HTTPS URL.`); }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:" || url.username || url.password || isPrivateHost(host)) throw new Error(`${label} must be a public HTTPS URL.`);
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function markdownToHtml(markdown) {
  const escaped = escapeHtml(String(markdown || "").replace(/\r\n/g, "\n"));
  return escaped.split(/\n{2,}/).map((block) => {
    const lines = block.split("\n");
    if (lines.every((line) => /^[-*]\s+/.test(line))) return `<ul>${lines.map((line) => `<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
    if (lines.every((line) => /^\d+\.\s+/.test(line))) return `<ol>${lines.map((line) => `<li>${inline(line.replace(/^\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
    if (lines[0].startsWith("### ")) return `<h3>${inline(lines.join(" ").slice(4))}</h3>`;
    if (lines[0].startsWith("## ")) return `<h2>${inline(lines.join(" ").slice(3))}</h2>`;
    if (lines[0].startsWith("&gt; ")) return `<blockquote>${inline(lines.join(" ").slice(5))}</blockquote>`;
    return `<p>${inline(lines.join(" "))}</p>`;
  }).join("\n");
}

function request(url, headers, payload, authorization = {}, meta = {}) {
  const body = JSON.stringify(payload);
  return { url, method: "POST", headers: { ...headers, ...authorization }, body, ...meta };
}
function field(key, label, type = "text", placeholder = "") { return { key, label, type, placeholder }; }
function cleanText(value, max) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function trimSlash(value) { return String(value).replace(/\/+$/, ""); }
function trimPath(value) { return String(value).replace(/^\/+|\/+$/g, ""); }
function deterministicExternalId(post) { return `whcms-${post.id}-v${post.version}`; }
function validateProviderConfig(provider, config) {
  const identifierKeys = Object.keys(config).filter((key) => !["baseUrl", "endpoint", "shopDomain"].includes(key));
  for (const key of identifierKeys) if (!/^[A-Za-z0-9_.:/-]+$/.test(config[key])) throw new Error(`${CONNECTOR_PROVIDERS[provider].fields.find((field) => field.key === key)?.label || key} contains unsupported characters.`);
  if (provider === "shopify" && !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(config.shopDomain)) throw new Error("Shop domain must be a myshopify.com hostname.");
  if (provider === "sanity" && !/^[a-z0-9-]+$/i.test(config.projectId)) throw new Error("Project ID contains unsupported characters.");
  if (provider === "contentful" && !["text", "rich-text"].includes(config.bodyFormat)) throw new Error("Contentful body format must be text or rich-text.");
}
function isPrivateHost(host) {
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host === "::1" || host === "::" || /^f[cd][0-9a-f]:/i.test(host) || /^fe[89ab][0-9a-f]:/i.test(host)) return true;
  if (host.includes(":") && (/^::ffff:/i.test(host) || /^2001:db8:/i.test(host) || /^ff/i.test(host))) return true;
  const parts = host.split(".");
  if (parts.length === 4 && parts.every((part) => /^\d+$/.test(part))) {
    const nums = parts.map(Number);
    if (nums.some((part) => part < 0 || part > 255)) return true;
    return nums[0] === 0 || nums[0] === 10 || nums[0] === 127 || nums[0] >= 224 ||
      (nums[0] === 100 && nums[1] >= 64 && nums[1] <= 127) || (nums[0] === 169 && nums[1] === 254) ||
      (nums[0] === 172 && nums[1] >= 16 && nums[1] <= 31) || (nums[0] === 192 && nums[1] === 168) ||
      (nums[0] === 192 && (nums[1] === 0 || nums[1] === 2)) ||
      (nums[0] === 198 && (nums[1] === 18 || nums[1] === 19 || nums[1] === 51)) ||
      (nums[0] === 203 && nums[1] === 0 && nums[2] === 113);
  }
  return false;
}
function escapeHtml(value) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function inline(value) {
  return value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
}

function contentfulRichText(markdown) {
  const content = String(markdown || "").replace(/\r\n/g, "\n").split(/\n{2,}/).filter(Boolean).map((block) => {
    const clean = block.replace(/^#{2,3}\s+/, "").replace(/^>\s+/, "").replace(/\n/g, " ");
    const nodeType = block.startsWith("### ") ? "heading-3" : block.startsWith("## ") ? "heading-2" : "paragraph";
    return { nodeType, data: {}, content: [{ nodeType: "text", value: clean, marks: [], data: {} }] };
  });
  return { nodeType: "document", data: {}, content: content.length ? content : [{ nodeType: "paragraph", data: {}, content: [] }] };
}

function sanityPortableText(markdown) {
  return String(markdown || "").replace(/\r\n/g, "\n").split("\n").map((line, index) => {
    const numbered = /^\d+\.\s+/.test(line); const bulleted = /^[-*]\s+/.test(line);
    const text = line.replace(/^#{2,3}\s+/, "").replace(/^>\s+/, "").replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
    return { _key: `block-${index}`, _type: "block", style: line.startsWith("### ") ? "h3" : line.startsWith("## ") ? "h2" : "normal",
      markDefs: [], children: [{ _key: `span-${index}`, _type: "span", marks: [], text }],
      ...(numbered || bulleted ? { level: 1, listItem: numbered ? "number" : "bullet" } : {}) };
  }).filter((block) => block.children[0].text);
}
