CREATE TABLE IF NOT EXISTS `arena_teachbacks` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `round_id` integer NOT NULL,
  `player_id` integer NOT NULL,
  `intent` text DEFAULT '' NOT NULL,
  `move` text DEFAULT '' NOT NULL,
  `lesson` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`round_id`) REFERENCES `arena_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`player_id`) REFERENCES `arena_players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `arena_teachbacks_round_player_unique` ON `arena_teachbacks` (`round_id`,`player_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `arena_teachbacks_round_idx` ON `arena_teachbacks` (`round_id`);
