CREATE TABLE `publishing_connectors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`secret_ciphertext` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`delivery_mode` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `publishing_connectors_enabled_provider_idx` ON `publishing_connectors` (`enabled`,`provider`);--> statement-breakpoint
ALTER TABLE `integration_deliveries` ADD `connector_id` integer;--> statement-breakpoint
ALTER TABLE `integration_deliveries` ADD `external_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `integration_deliveries` ADD `external_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `integration_deliveries_connector_id_idx` ON `integration_deliveries` (`connector_id`);
