ALTER TABLE `arena_rooms` ADD `match_length` integer DEFAULT 3 NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_rooms` ADD `match_format` text DEFAULT 'SOLO' NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_rooms` ADD `rotation_mode` text DEFAULT 'AUTO' NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_rooms` ADD `match_status` text DEFAULT 'setup' NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_rooms` ADD `match_number` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_rooms` ADD `signal_score` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_rooms` ADD `static_score` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_players` ADD `team` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_rounds` ADD `match_number` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_rounds` ADD `winning_team` text DEFAULT '' NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS `arena_rounds_room_number_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `arena_rounds_room_match_number_unique` ON `arena_rounds` (`room_id`,`match_number`,`round_number`);
