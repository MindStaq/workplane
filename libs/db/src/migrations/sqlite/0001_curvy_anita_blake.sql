CREATE TABLE `workplan_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text,
	`plan_id` text NOT NULL,
	`plan_name` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`idempotency_key` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`ended_at` text,
	`error` text,
	FOREIGN KEY (`schedule_id`) REFERENCES `workplan_schedules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_workplan_runs_schedule_id` ON `workplan_runs` (`schedule_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workplan_runs_idempotency` ON `workplan_runs` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `workplan_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`name` text NOT NULL,
	`cron_expression` text NOT NULL,
	`timezone` text NOT NULL,
	`inputs` text DEFAULT '{}' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_run_at` text,
	`next_run_at` text,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_workplan_schedules_due` ON `workplan_schedules` (`next_run_at`);--> statement-breakpoint
CREATE TABLE `workplan_step_results` (
	`id` text PRIMARY KEY NOT NULL,
	`workplan_run_id` text NOT NULL,
	`step_id` text NOT NULL,
	`step_name` text NOT NULL,
	`output` text,
	`exit_code` integer,
	`duration_ms` integer,
	`metadata` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workplan_run_id`) REFERENCES `workplan_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_workplan_step_results_run_id` ON `workplan_step_results` (`workplan_run_id`);