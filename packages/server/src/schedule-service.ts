import { createDefaultRegistry } from "../../agent-skills/src/skills/index.js";
import type { WorkplaneStore } from "../../db/src/store-interface.js";
import { LocalWorkplanContext } from "../../workplans/src/context.js";
import { ScheduleBuilder, WorkplanScheduler } from "../../workplans/src/index.js";
import type { CreateWorkplanScheduleInput, UpdateWorkplanScheduleInput } from "../../types/src/index.js";

const skillRegistry = createDefaultRegistry();

export function createWorkplanScheduler(store: WorkplaneStore): WorkplanScheduler {
  return new WorkplanScheduler(
    store,
    {
      resolve(planId, inputs) {
        const skill = skillRegistry.get(planId);
        if (!skill) {
          throw new Error(`unknown workplan skill: ${planId}`);
        }
        return skill.buildPlan(inputs);
      },
    },
    () => new LocalWorkplanContext(),
  );
}

export function withScheduleTiming(
  input: CreateWorkplanScheduleInput,
): CreateWorkplanScheduleInput {
  if (input.enabled === false) {
    return { ...input, nextRunAt: null };
  }
  return {
    ...input,
    nextRunAt: ScheduleBuilder.nextRunAt(input.cronExpression, input.timezone),
  };
}

export function withUpdatedScheduleTiming(
  current: { cronExpression: string; timezone: string; enabled: boolean },
  input: UpdateWorkplanScheduleInput,
): UpdateWorkplanScheduleInput {
  const cronExpression = input.cronExpression ?? current.cronExpression;
  const timezone = input.timezone ?? current.timezone;
  const enabled = input.enabled ?? current.enabled;

  if (!enabled) {
    return { ...input, nextRunAt: null };
  }

  if (input.cronExpression !== undefined || input.timezone !== undefined || input.enabled === true) {
    return {
      ...input,
      nextRunAt: ScheduleBuilder.nextRunAt(cronExpression, timezone),
    };
  }

  return input;
}

export function isSchedulerEnabled(): boolean {
  return process.env.WORKPLANE_SCHEDULER_ENABLED !== "false";
}

export function schedulerIntervalMs(): number {
  const raw = process.env.WORKPLANE_SCHEDULER_INTERVAL_MS;
  const parsed = raw ? Number(raw) : 60_000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
}

export function startSchedulerLoop(scheduler: WorkplanScheduler): () => void {
  const intervalMs = schedulerIntervalMs();
  const timer = setInterval(() => {
    void scheduler.tick().catch((error) => {
      process.stderr.write(`workplan scheduler tick failed: ${String(error)}\n`);
    });
  }, intervalMs);
  timer.unref();

  void scheduler.tick().catch((error) => {
    process.stderr.write(`workplan scheduler initial tick failed: ${String(error)}\n`);
  });

  process.stdout.write(`workplan scheduler enabled (interval ${intervalMs}ms)\n`);
  return () => clearInterval(timer);
}

export function listKnownPlanIds(): string[] {
  return skillRegistry.list().map((skill) => skill.name);
}
