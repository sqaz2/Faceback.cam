CREATE TABLE `profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`handle` text NOT NULL,
	`display_name` text NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`story` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`website_url` text DEFAULT '' NOT NULL,
	`accent` text DEFAULT 'signal' NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_user_email_unique` ON `profiles` (`user_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_handle_unique` ON `profiles` (`handle`);--> statement-breakpoint
CREATE TABLE `works` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`provider` text DEFAULT 'Website' NOT NULL,
	`category` text DEFAULT 'Project' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `works_profile_sort_idx` ON `works` (`profile_id`,`sort_order`);