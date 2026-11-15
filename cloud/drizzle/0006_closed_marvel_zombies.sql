CREATE TABLE `resident_memories` (
	`id` text PRIMARY KEY NOT NULL,
	`resident_id` text NOT NULL,
	`process_id` text NOT NULL,
	`state` text NOT NULL,
	`phase` text,
	`event_key` text NOT NULL,
	`text` text NOT NULL,
	`at` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resident_memories_event` ON `resident_memories` (`event_key`);--> statement-breakpoint
CREATE INDEX `resident_memories_resident_created` ON `resident_memories` (`resident_id`,`created_at`);