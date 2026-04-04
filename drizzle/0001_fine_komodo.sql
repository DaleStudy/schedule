DROP INDEX `participants_token_unique`;--> statement-breakpoint
CREATE INDEX `idx_participants_event_name` ON `participants` (`event_id`,`name`);--> statement-breakpoint
ALTER TABLE `participants` DROP COLUMN `token`;