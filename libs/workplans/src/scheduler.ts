import type {
  WorkplanRunRecord,
  WorkplanScheduleRecord,
  WorkplanStepResultInput,
} from "../../types/src/index.js";
import { ScheduleBuilder } from "./schedule-builder.js";
import { SequentialWorkplanRunner } from "./runner.js";
import { validateWorkplan } from "./validate.js";
import type { StepResult, Workplan, WorkplanRunContext, WorkplanRunner, WorkplanStep } from "./types.js";

export interface ScheduleStore {
  listDueWorkplanSchedules(asOf: string): Promise<WorkplanScheduleRecord[]>;
  getWorkplanSchedule(scheduleId: string): Promise<WorkplanScheduleRecord | null>;
  markWorkplanScheduleRan(scheduleId: string, lastRunAt: string, nextRunAt: string): Promise<void>;
  tryCreateWorkplanRun(input: {
    scheduleId?: string;
    planId: string;
    planName: string;
    idempotencyKey?: string;
    inputs?: Record<string, unknown>;
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

export interface StartedWorkplanRun {
  run: WorkplanRunRecord;
  /** Settles with the final run record once every step has finished. */
  completion: Promise<WorkplanRunRecord | null>;
}

function toStepInput(step: WorkplanStep | undefined, result: StepResult): WorkplanStepResultInput {
  return {
    stepId: result.stepId,
    stepName: step?.name ?? result.stepId,
    status: result.status,
    taskId: result.taskId,
    runId: result.runId,
    output: result.output,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    metadata: result.metadata,
  };
}

export class WorkplanScheduler {
  constructor(
    private readonly store: ScheduleStore,
    private readonly resolver: PlanResolver,
    /** Receives the run being executed, so a context can key approvals or logs by run ID. */
    private readonly contextFactory: (run: WorkplanRunRecord) => WorkplanRunContext,
    private readonly runner: WorkplanRunner = new SequentialWorkplanRunner(),
  ) {}

  /**
   * Resolves and validates a plan, records a run and starts it without waiting for it to finish.
   * Throws (before anything is recorded) when the plan is unknown or invalid.
   */
  async startRun(planId: string, inputs: Record<string, unknown> = {}): Promise<StartedWorkplanRun> {
    const plan = this.resolver.resolve(planId, inputs);
    validateWorkplan(plan);
    const run = await this.store.tryCreateWorkplanRun({ planId, planName: plan.name, inputs });
    if (!run) {
      throw new Error(`could not create a workplan run for ${planId}`);
    }
    return { run, completion: this.execute(run, plan) };
  }

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
      inputs: schedule.inputs,
    });
    if (!run) {
      return null;
    }

    if (options.advanceSchedule) {
      const nextRunAt = ScheduleBuilder.nextRunAt(schedule.cronExpression, schedule.timezone);
      await this.store.markWorkplanScheduleRan(schedule.id, options.scheduledTime, nextRunAt);
    }

    let plan: Workplan;
    try {
      plan = this.resolver.resolve(schedule.planId, schedule.inputs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return await this.store.updateWorkplanRun(run.id, "failed", message);
    }
    return this.execute(run, plan);
  }

  private async execute(run: WorkplanRunRecord, plan: Workplan): Promise<WorkplanRunRecord | null> {
    const stepsById = new Map(plan.steps.map((step) => [step.id, step]));
    const persisted = new Set<string>();
    const base = this.contextFactory(run);
    let waitingForApproval = 0;

    const ctx: WorkplanRunContext = {
      resolveNode: (requires, provider) => base.resolveNode(requires, provider),
      emitResult: (stepId, stepName, output) => base.emitResult(stepId, stepName, output),
      onStepResult: async (step, result) => {
        persisted.add(result.stepId);
        await this.store.appendWorkplanStepResults(run.id, [toStepInput(step, result)]);
        await base.onStepResult?.(step, result);
      },
      awaitApproval: base.awaitApproval
        ? async (request) => {
            waitingForApproval += 1;
            await this.store.updateWorkplanRun(run.id, "waiting_for_approval");
            try {
              return await base.awaitApproval!(request);
            } finally {
              waitingForApproval -= 1;
              if (waitingForApproval === 0) {
                await this.store.updateWorkplanRun(run.id, "running");
              }
            }
          }
        : undefined,
    };

    try {
      const result = await this.runner.run(plan, ctx);
      // A custom runner may not report steps as they finish; record whatever it did not.
      const missing = result.steps.filter((step) => !persisted.has(step.stepId));
      if (missing.length > 0) {
        await this.store.appendWorkplanStepResults(run.id, missing.map((step) => toStepInput(stepsById.get(step.stepId), step)));
      }

      const failedStep = [...result.steps].reverse().find((step) => step.status === "failed")
        ?? (result.succeeded ? undefined : result.steps.at(-1));
      const error = result.succeeded ? undefined : failedStep?.output;
      return await this.store.updateWorkplanRun(run.id, result.status, error);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return await this.store.updateWorkplanRun(run.id, "failed", message);
    }
  }
}
