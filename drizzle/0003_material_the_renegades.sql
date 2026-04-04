DROP INDEX `idx_participants_event_name`;--> statement-breakpoint
ALTER TABLE `participants` ADD `email` text NOT NULL DEFAULT '';--> statement-breakpoint
CREATE INDEX `idx_participants_event_email` ON `participants` (`event_id`,`email`);