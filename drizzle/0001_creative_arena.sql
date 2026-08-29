CREATE TABLE IF NOT EXISTS `arena_rooms` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `code` text NOT NULL,
  `host_email` text NOT NULL,
  `phase` text DEFAULT 'lobby' NOT NULL,
  `round_number` integer DEFAULT 0 NOT NULL,
  `max_players` integer DEFAULT 8 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `arena_rooms_code_unique` ON `arena_rooms` (`code`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `arena_players` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `room_id` integer NOT NULL,
  `user_email` text NOT NULL,
  `display_name` text NOT NULL,
  `profile_handle` text DEFAULT '' NOT NULL,
  `score` integer DEFAULT 0 NOT NULL,
  `joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`room_id`) REFERENCES `arena_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `arena_players_room_user_unique` ON `arena_players` (`room_id`,`user_email`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `arena_players_room_idx` ON `arena_players` (`room_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `arena_rounds` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `room_id` integer NOT NULL,
  `round_number` integer NOT NULL,
  `prompt` text NOT NULL,
  `mode` text NOT NULL,
  `status` text DEFAULT 'answering' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `voting_opened_at` text,
  `revealed_at` text,
  FOREIGN KEY (`room_id`) REFERENCES `arena_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `arena_rounds_room_number_unique` ON `arena_rounds` (`room_id`,`round_number`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `arena_submissions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `round_id` integer NOT NULL,
  `player_id` integer NOT NULL,
  `content` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`round_id`) REFERENCES `arena_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`player_id`) REFERENCES `arena_players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `arena_submissions_round_player_unique` ON `arena_submissions` (`round_id`,`player_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `arena_votes` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `round_id` integer NOT NULL,
  `voter_player_id` integer NOT NULL,
  `submission_id` integer NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`round_id`) REFERENCES `arena_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`voter_player_id`) REFERENCES `arena_players`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`submission_id`) REFERENCES `arena_submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `arena_votes_round_voter_unique` ON `arena_votes` (`round_id`,`voter_player_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `arena_votes_submission_idx` ON `arena_votes` (`submission_id`);
