ALTER TABLE `arena_rooms` ADD `timer_preset` text DEFAULT 'STANDARD' NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_rooms` ADD `answer_seconds` integer DEFAULT 75 NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_rooms` ADD `vote_seconds` integer DEFAULT 30 NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_rounds` ADD `answer_deadline_at` text;
--> statement-breakpoint
ALTER TABLE `arena_rounds` ADD `vote_deadline_at` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `arena_players_profile_handle_idx` ON `arena_players` (`profile_handle`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `arena_rounds_room_match_status_idx` ON `arena_rounds` (`room_id`,`match_number`,`status`);
