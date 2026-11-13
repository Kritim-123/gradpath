CREATE TABLE `paper_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `paper_cache_expiry` ON `paper_cache` (`expires_at`);--> statement-breakpoint
CREATE TABLE `paper_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `paper_limits_expiry` ON `paper_limits` (`expires_at`);