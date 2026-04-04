CREATE TABLE `availability_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`event_id` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_slots_participant` ON `availability_slots` (`participant_id`);--> statement-breakpoint
CREATE INDEX `idx_slots_event` ON `availability_slots` (`event_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`admin_token` text NOT NULL,
	`timezone` text NOT NULL,
	`event_date_start` text NOT NULL,
	`event_date_end` text NOT NULL,
	`response_deadline_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`confirmed_start` text,
	`confirmed_end` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_admin_token_unique` ON `events` (`admin_token`);--> statement-breakpoint
CREATE INDEX `idx_events_status_deadline` ON `events` (`status`,`response_deadline_at`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`token` text NOT NULL,
	`timezone` text,
	`responded_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_token_unique` ON `participants` (`token`);--> statement-breakpoint
CREATE INDEX `idx_participants_event` ON `participants` (`event_id`);