CREATE TABLE `site_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`site_name` text NOT NULL,
	`tagline` text NOT NULL,
	`description` text NOT NULL,
	`primary_color` text NOT NULL,
	`accent_color` text NOT NULL,
	`background_color` text NOT NULL,
	`text_color` text NOT NULL,
	`custom_css` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
