import type {
  WorkplanRunRecord,
  WorkplanScheduleRecord,
  WorkplanStepResultInput,
} from "../../types/src/index.js";
import { ScheduleBuilder } from "./schedule-builder.js";
import { SequentialWorkplanRunner } from "./runner.js";
import type { Workplan, WorkplanRunContext, WorkplanRunner } from "./types.js";

export interface ScheduleStore {
  listDueWorkplanSchedules(asOf: string): Promise<WorkplanScheduleRecord[]>;
  getWorkplanSchedule(scheduleId: string): Promise<WorkplanScheduleRecord | null>;
  markWorkplanScheduleRan(scheduleId: string, lastRunAt: string, nextRunAt: string): Promise<void>;
  tryCreateWorkplanRun(input: {
    scheduleId?: string;
    planId: string;
    planName: string;
    idempotencyKey?: string;
  }): Promise<WorkplanRunRecord | null>;
  updateWorkplanRun(
    runId: string,
    status: WorkplanRunRecord["status"],
    error?: string,
    endedAt?: string,
  ): Promise<WorkplanRunRecord | null>;
  appendWorkplanStepResults(runId: string, steps: WorkplanStepResultInput[]): Promise<unknown>;
}

export interface PlanResolver {
  resolve(planId: string, inputs: Record<string, unknown>): Workplan;
}

export interface ExecuteScheduleOptions {
  advanceSchedule?: boolean;
  idempotencyKey?: string;
}

export class WorkplanScheduler {
  constructor(
    private readonly store: ScheduleStore,
    private readonly resolver: PlanResolver,
    private readonly contextFactory: () => WorkplanRunContext,
    private readonly runner: WorkplanRunner = new SequentialWorkplanRunner(),
  ) {}

  async tick(now = new Date()): Promise<WorkplanRunRecord[]> {
    const due = await this.store.listDueWorkplanSchedules(now.toISOString());
    const launched: WorkplanRunRecord[] = [];

    for (const schedule of due) {
      if (!schedule.nextRunAt) {
        continue;
      }
      const run = await this.executeSchedule(schedule, {
        scheduledTime: schedule.nextRunAt,
        advanceSchedule: true,
      });
      if (run) {
        launched.push(run);
      }
    }

    return launched;
  }

  async runNow(scheduleId: string): Promise<WorkplanRunRecord | null> {
    const schedule = await this.store.getWorkplanSchedule(scheduleId);
    if (!schedule) {
      return null;
    }

    return this.executeSchedule(schedule, {
      scheduledTime: new Date().toISOString(),
      advanceSchedule: false,
    });
  }

  async executeSchedule(
    schedule: WorkplanScheduleRecord,
    options: ExecuteScheduleOptions & { scheduledTime: string },
  ): Promise<WorkplanRunRecord | null> {
    const idempotencyKey = options.idempotencyKey
      ?? (options.advanceSchedule ? `${schedule.id}:${options.scheduledTime}` : undefined);

    const run = await this.store.tryCreateWorkplanRun({
      scheduleId: schedule.id,
      planId: schedule.planId,
      planName: schedule.name,
      idempotencyKey,
    });
    if (!run) {
      return null;
    }

    if (options.advanceSchedule) {
      const nextRunAt = ScheduleBuilder.nextRunAt(schedule.cronExpression, schedule.timezone);
      await this.store.markWorkplanScheduleRan(schedule.id, options.scheduledTime, nextRunAt);
    }

    try {
      const plan = this.resolver.resolve(schedule.planId, schedule.inputs);
      const result = await this.runner.run(plan, this.contextFactory());
      const stepNames = new Map(plan.steps.map((step) => [step.id, step.name]));
      const stepInputs: WorkplanStepResultInput[] = result.steps.map((step) => ({
        stepId: step.stepId,
        stepName: stepNames.get(step.stepId) ?? step.stepId,
        output: step.output,
        exitCode: step.exitCode,
        durationMs: step.durationMs,
        metadata: step.metadata,
      }));
      await this.store.appendWorkplanStepResults(run.id, stepInputs);

      const error = result.succeeded ? undefined : result.steps.at(-1)?.output;
      return await this.store.updateWorkplanRun(run.id, result.status, error);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return await this.store.updateWorkplanRun(run.id, "failed", message);
    }
  }
}
