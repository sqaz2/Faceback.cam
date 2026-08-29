CREATE TABLE `game_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_code` text NOT NULL,
	`user_email` text NOT NULL,
	`display_name` text NOT NULL,
	`handle` text DEFAULT '' NOT NULL,
	`seat` integer NOT NULL,
	`ready` integer DEFAULT false NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `game_rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_players_room_user_unique` ON `game_players` (`room_code`,`user_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_players_room_seat_unique` ON `game_players` (`room_code`,`seat`);--> statement-breakpoint
CREATE INDEX `game_players_room_seen_idx` ON `game_players` (`room_code`,`last_seen_at`);--> statement-breakpoint
CREATE TABLE `game_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`host_email` text NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`max_players` integer DEFAULT 6 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`started_at` text
);
--> statement-breakpoint
CREATE INDEX `game_rooms_host_created_idx` ON `game_rooms` (`host_email`,`created_at`);