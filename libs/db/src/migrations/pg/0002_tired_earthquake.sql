ALTER TABLE "workplan_runs" ADD COLUMN "inputs" jsonb;--> statement-breakpoint
ALTER TABLE "workplan_step_results" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "workplan_step_results" ADD COLUMN "task_id" text;--> statement-breakpoint
ALTER TABLE "workplan_step_results" ADD COLUMN "run_id" text;