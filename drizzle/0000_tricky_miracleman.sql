CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`institution` text NOT NULL,
	`department` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`interests` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_user_id_unique` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_thread_time` ON `messages` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_sender_time` ON `messages` (`sender_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `join_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`research_id` text NOT NULL,
	`student_id` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`research_id`) REFERENCES `research`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_request_per_student` ON `join_requests` (`research_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `requests_student` ON `join_requests` (`student_id`);--> statement-breakpoint
CREATE TABLE `research` (
	`id` text PRIMARY KEY NOT NULL,
	`faculty_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`field` text NOT NULL,
	`skills` text NOT NULL,
	`commitment` text NOT NULL,
	`location` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`faculty_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `research_faculty` ON `research` (`faculty_id`);--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`faculty_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`faculty_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_thread_per_pair` ON `threads` (`student_id`,`faculty_id`);