CREATE TABLE `cloud_bridge` (
	`id` text PRIMARY KEY NOT NULL,
	`model_name` text NOT NULL,
	`last_seen` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cloud_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cloud_conversations_user_updated` ON `cloud_conversations` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `cloud_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`question` text NOT NULL,
	`internet` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`agent_id` text,
	`lease_token` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`result` text,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `cloud_conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cloud_jobs_user_request` ON `cloud_jobs` (`user_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `cloud_jobs_status_lease` ON `cloud_jobs` (`status`,`lease_until`);--> statement-breakpoint
CREATE INDEX `cloud_jobs_user_created` ON `cloud_jobs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `cloud_jobs_conversation_status` ON `cloud_jobs` (`conversation_id`,`status`);--> statement-breakpoint
CREATE TABLE `cloud_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `cloud_conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cloud_messages_conversation` ON `cloud_messages` (`conversation_id`,`created_at`);