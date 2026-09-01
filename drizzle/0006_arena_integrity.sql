ALTER TABLE `arena_players` ADD `profile_id` integer;
--> statement-breakpoint
UPDATE `arena_players`
SET `profile_id` = (
  SELECT `profiles`.`id`
  FROM `profiles`
  WHERE `profiles`.`user_email` = `arena_players`.`user_email`
  LIMIT 1
)
WHERE `profile_id` IS NULL;
--> statement-breakpoint
ALTER TABLE `arena_players` ADD `active` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_players` ADD `left_at` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `arena_players_profile_id_idx` ON `arena_players` (`profile_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `arena_players_room_active_idx` ON `arena_players` (`room_id`,`active`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `arena_round_awards` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `round_id` integer NOT NULL,
  `player_id` integer NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`round_id`) REFERENCES `arena_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`player_id`) REFERENCES `arena_players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `arena_round_awards_round_player_unique` ON `arena_round_awards` (`round_id`,`player_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `arena_round_awards_player_idx` ON `arena_round_awards` (`player_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `arena_round_awards` (`round_id`, `player_id`)
SELECT `ranked`.`round_id`, `ranked`.`player_id`
FROM (
  SELECT
    `arena_submissions`.`round_id`,
    `arena_submissions`.`player_id`,
    COUNT(`arena_votes`.`id`) AS `vote_count`,
    MAX(COUNT(`arena_votes`.`id`)) OVER (
      PARTITION BY `arena_submissions`.`round_id`
    ) AS `top_vote_count`
  FROM `arena_submissions`
  JOIN `arena_rounds` ON `arena_rounds`.`id` = `arena_submissions`.`round_id`
  LEFT JOIN `arena_votes` ON `arena_votes`.`submission_id` = `arena_submissions`.`id`
  WHERE `arena_rounds`.`status` = 'results'
  GROUP BY `arena_submissions`.`id`, `arena_submissions`.`round_id`, `arena_submissions`.`player_id`
) AS `ranked`
WHERE `ranked`.`vote_count` = `ranked`.`top_vote_count`
  AND `ranked`.`top_vote_count` > 0;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `arena_action_limits` (
  `scope` text NOT NULL,
  `actor_key` text NOT NULL,
  `bucket` integer NOT NULL,
  `request_count` integer DEFAULT 1 NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (`scope`,`actor_key`,`bucket`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `arena_action_limits_bucket_idx` ON `arena_action_limits` (`bucket`);
