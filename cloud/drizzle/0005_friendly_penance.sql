ALTER TABLE `cloud_bridge` ADD `capabilities` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `cloud_jobs` ADD `kind` text DEFAULT 'chat' NOT NULL;--> statement-breakpoint
ALTER TABLE `cloud_jobs` ADD `parameters` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `cloud_jobs` ADD `progress` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cloud_jobs` ADD `stage` text;