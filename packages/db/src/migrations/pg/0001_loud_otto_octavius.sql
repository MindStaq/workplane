CREATE TABLE "workplan_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"schedule_id" text,
	"plan_id" text NOT NULL,
	"plan_name" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "workplan_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"name" text NOT NULL,
	"cron_expression" text NOT NULL,
	"timezone" text NOT NULL,
	"inputs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workplan_step_results" (
	"id" text PRIMARY KEY NOT NULL,
	"workplan_run_id" text NOT NULL,
	"step_id" text NOT NULL,
	"step_name" text NOT NULL,
	"output" text,
	"exit_code" integer,
	"duration_ms" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workplan_runs" ADD CONSTRAINT "workplan_runs_schedule_id_workplan_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."workplan_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workplan_step_results" ADD CONSTRAINT "workplan_step_results_workplan_run_id_workplan_runs_id_fk" FOREIGN KEY ("workplan_run_id") REFERENCES "public"."workplan_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_workplan_runs_schedule_id" ON "workplan_runs" USING btree ("schedule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workplan_runs_idempotency" ON "workplan_runs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_workplan_schedules_due" ON "workplan_schedules" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "idx_workplan_step_results_run_id" ON "workplan_step_results" USING btree ("workplan_run_id");