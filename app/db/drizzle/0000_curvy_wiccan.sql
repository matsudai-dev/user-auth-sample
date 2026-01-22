CREATE TABLE `deleted_users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`deleted_at` integer DEFAULT (unixepoch()) NOT NULL,
	`reregistration_allowed_at` integer NOT NULL,
	`expire_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_change_sessions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`new_email` text NOT NULL,
	`email_change_token_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expire_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `login_rate_limits` (
	`email` text PRIMARY KEY NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`last_attempt_at` integer NOT NULL,
	`expire_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `login_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`refresh_token_hash` text NOT NULL,
	`user_agent` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_accessed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expire_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mfa_email_otp_backup_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`backup_code_hash` text NOT NULL,
	`last_four_chars` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mfa_email_otp_disable_sessions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`mfa_email_otp_disable_session_token_hash` text NOT NULL,
	`otp_code_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expire_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mfa_email_otp_enable_sessions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`mfa_email_otp_enable_session_token_hash` text NOT NULL,
	`otp_code_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expire_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mfa_email_otp_login_sessions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`mfa_email_otp_login_session_token_hash` text NOT NULL,
	`otp_code_hash` text NOT NULL,
	`remember_me` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expire_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mfa_totp_backup_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`backup_code_hash` text NOT NULL,
	`last_four_chars` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mfa_totp_enable_sessions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`mfa_totp_enable_session_token_hash` text NOT NULL,
	`totp_secret` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expire_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mfa_totp_login_sessions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`mfa_totp_login_session_token_hash` text NOT NULL,
	`remember_me` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expire_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `password_change_rate_limits` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last_request_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expire_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `password_reset_rate_limits` (
	`email` text PRIMARY KEY NOT NULL,
	`last_request_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expire_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `password_reset_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`password_reset_token_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expire_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `signup_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`signup_session_token_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expire_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signup_sessions_email_unique` ON `signup_sessions` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `signup_sessions_signup_session_token_hash_unique` ON `signup_sessions` (`signup_session_token_hash`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`mfa_email_otp_enabled` integer DEFAULT false NOT NULL,
	`mfa_totp_secret` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);