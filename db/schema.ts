import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const blogPosts = sqliteTable(
  "blog_posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    purpose: text("purpose").notNull().default(""),
    content: text("content").notNull().default(""),
    category: text("category").notNull().default("General"),
    status: text("status").notNull().default("planned"),
    publishDate: text("publish_date").notNull(),
    publishTime: text("publish_time").notNull().default("00:00"),
    featured: integer("featured", { mode: "boolean" })
      .notNull()
      .default(false),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    authorEmail: text("author_email").notNull().default(""),
    approvalStatus: text("approval_status").notNull().default("draft"),
    approvedBy: text("approved_by").notNull().default(""),
    approvedAt: text("approved_at"),
    version: integer("version").notNull().default(1),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("blog_posts_status_publish_date_idx").on(
      table.status,
      table.publishDate,
    ),
  ],
);

export const siteSettings = sqliteTable("site_settings", {
  id: integer("id").primaryKey(),
  siteName: text("site_name").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  primaryColor: text("primary_color").notNull(),
  accentColor: text("accent_color").notNull(),
  backgroundColor: text("background_color").notNull(),
  textColor: text("text_color").notNull(),
  customCss: text("custom_css").notNull().default(""),
  logoUrl: text("logo_url").notNull().default(""),
  faviconUrl: text("favicon_url").notNull().default(""),
  headingFont: text("heading_font").notNull().default("Inter"),
  bodyFont: text("body_font").notNull().default("Inter"),
  layoutStyle: text("layout_style").notNull().default("editorial"),
  navigationJson: text("navigation_json").notNull().default("[]"),
  customDomain: text("custom_domain").notNull().default(""),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const cmsUsers = sqliteTable(
  "cms_users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull().unique(),
    displayName: text("display_name").notNull().default(""),
    role: text("role").notNull().default("author"),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("cms_users_role_status_idx").on(table.role, table.status)],
);

export const postRevisions = sqliteTable(
  "post_revisions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id").notNull(),
    version: integer("version").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    changedBy: text("changed_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("post_revisions_post_version_idx").on(table.postId, table.version)],
);

export const postComments = sqliteTable(
  "post_comments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id").notNull(),
    body: text("body").notNull(),
    authorEmail: text("author_email").notNull(),
    resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("post_comments_post_id_idx").on(table.postId)],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull().default(""),
    detailsJson: text("details_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("audit_events_created_at_idx").on(table.createdAt)],
);

export const mediaAssets = sqliteTable(
  "media_assets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    objectKey: text("object_key").notNull().unique(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    altText: text("alt_text").notNull().default(""),
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("media_assets_created_at_idx").on(table.createdAt)],
);

export const aiSettings = sqliteTable("ai_settings", {
  id: integer("id").primaryKey(),
  provider: text("provider").notNull().default("openai"),
  model: text("model").notNull().default("gpt-4.1-mini"),
  baseUrl: text("base_url").notNull().default("https://api.openai.com/v1"),
  apiKeyCiphertext: text("api_key_ciphertext").notNull().default(""),
  audience: text("audience").notNull().default(""),
  voice: text("voice").notNull().default(""),
  guardrails: text("guardrails").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const integrationSettings = sqliteTable("integration_settings", {
  id: integer("id").primaryKey(),
  postizWebhookUrl: text("postiz_webhook_url").notNull().default(""),
  postizTokenCiphertext: text("postiz_token_ciphertext").notNull().default(""),
  wordpressSiteUrl: text("wordpress_site_url").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const publishingConnectors = sqliteTable(
  "publishing_connectors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    provider: text("provider").notNull(),
    name: text("name").notNull(),
    configJson: text("config_json").notNull().default("{}"),
    secretCiphertext: text("secret_ciphertext").notNull().default(""),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    deliveryMode: text("delivery_mode").notNull().default("draft"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("publishing_connectors_enabled_provider_idx").on(table.enabled, table.provider)],
);

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    bucket: text("bucket").primaryKey(),
    count: integer("count").notNull().default(0),
    resetAt: text("reset_at").notNull(),
  },
  (table) => [index("rate_limits_reset_at_idx").on(table.resetAt)],
);

export const integrationDeliveries = sqliteTable(
  "integration_deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    provider: text("provider").notNull(),
    eventType: text("event_type").notNull(),
    postId: integer("post_id").notNull(),
    connectorId: integer("connector_id"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    payloadJson: text("payload_json").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error").notNull().default(""),
    nextAttemptAt: text("next_attempt_at").notNull(),
    externalId: text("external_id").notNull().default(""),
    externalUrl: text("external_url").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("integration_deliveries_status_next_idx").on(
      table.status,
      table.nextAttemptAt,
    ),
    index("integration_deliveries_connector_id_idx").on(table.connectorId),
  ],
);

export const aiUsage = sqliteTable(
  "ai_usage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorEmail: text("actor_email").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    status: text("status").notNull(),
    durationMs: integer("duration_ms").notNull(),
    inputCharacters: integer("input_characters").notNull(),
    outputCharacters: integer("output_characters").notNull(),
    errorMessage: text("error_message").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("ai_usage_created_at_idx").on(table.createdAt)],
);
