CREATE TABLE `ai_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'openai' NOT NULL,
	`model` text DEFAULT 'gpt-4.1-mini' NOT NULL,
	`base_url` text DEFAULT 'https://api.openai.com/v1' NOT NULL,
	`api_key_ciphertext` text DEFAULT '' NOT NULL,
	`audience` text DEFAULT '' NOT NULL,
	`voice` text DEFAULT '' NOT NULL,
	`guardrails` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text DEFAULT '' NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_events_created_at_idx` ON `audit_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `cms_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'author' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_users_email_unique` ON `cms_users` (`email`);--> statement-breakpoint
CREATE INDEX `cms_users_role_status_idx` ON `cms_users` (`role`,`status`);--> statement-breakpoint
CREATE TABLE `integration_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`postiz_webhook_url` text DEFAULT '' NOT NULL,
	`postiz_token_ciphertext` text DEFAULT '' NOT NULL,
	`wordpress_site_url` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`alt_text` text DEFAULT '' NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_object_key_unique` ON `media_assets` (`object_key`);--> statement-breakpoint
CREATE INDEX `media_assets_created_at_idx` ON `media_assets` (`created_at`);--> statement-breakpoint
CREATE TABLE `post_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`body` text NOT NULL,
	`author_email` text NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `post_comments_post_id_idx` ON `post_comments` (`post_id`);--> statement-breakpoint
CREATE TABLE `post_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`version` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`changed_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `post_revisions_post_version_idx` ON `post_revisions` (`post_id`,`version`);--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `author_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `approval_status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `approved_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `approved_at` text;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `logo_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `favicon_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `heading_font` text DEFAULT 'Inter' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `body_font` text DEFAULT 'Inter' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `layout_style` text DEFAULT 'editorial' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `navigation_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `custom_domain` text DEFAULT '' NOT NULL;