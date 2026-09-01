ALTER TABLE `arena_rooms` ADD `visibility` text DEFAULT 'public' NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_players` ADD `is_bot` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_players` ADD `bot_key` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `arena_rooms_public_joinable_idx` ON `arena_rooms` (`visibility`,`phase`,`updated_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `arena_players_room_bot_idx` ON `arena_players` (`room_id`,`active`,`is_bot`);
