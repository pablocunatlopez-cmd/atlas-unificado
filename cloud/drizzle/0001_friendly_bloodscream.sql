CREATE TABLE `atlas_lab` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`content` text NOT NULL,
	`updated_at` text NOT NULL
);
