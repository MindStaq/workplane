import type {
  StepResult,
  StepStatus,
  Workplan,
  WorkplanResult,
  WorkplanRunContext,
  WorkplanRunner,
  WorkplanStatus,
  WorkplanStep,
} from "./types.js";
import { applyTemplate } from "./template.js";
import { evaluateCondition, type StepView } from "./expression.js";
import { StepExecutionError } from "./errors.js";
import { isGraphPlan, validateWorkplan } from "./validate.js";

const INLINE_PROVIDERS = new Set(["anthropic", "openai", "ollama", "shell", "file"]);
const DEFAULT_MAX_PARALLEL = 4;

async function runInlineStep(step: WorkplanStep, prompt: string): Promise<string> {
  const provider = step.provider!;
  if (provider === "anthropic") {
    const { runAnthropicStep } = await import("./providers/anthropic.js");
    return runAnthropicStep({ model: step.model ?? "claude-haiku-4-5-20251001", prompt });
  }
  if (provider === "openai") {
    const { runOpenAIStep } = await import("./providers/openai.js");
    return runOpenAIStep({ model: step.model ?? "gpt-4o-mini", prompt });
  }
  if (provider === "ollama") {
    const { runOllamaStep } = await import("./providers/ollama.js");
    return runOllamaStep({ model: step.model ?? "llama3", prompt });
  }
  if (provider === "shell") {
    const { runShellStep } = await import("./providers/shell.js");
    return runShellStep({
      command: String(step.payload.command ?? ""),
      cwd: typeof step.payload.cwd === "string" ? step.payload.cwd : undefined,
    });
  }
  if (provider === "file") {
    const { runFileStep } = await import("./providers/file.js");
    return runFileStep({ path: String(step.payload.path ?? "") });
  }
  throw new Error(`unknown inline provider: ${provider}`);
}

function result(step: WorkplanStep, status: StepStatus, output: string, exitCode: number, start: number): StepResult {
  return { stepId: step.id, output, exitCode, durationMs: Date.now() - start, status };
}

async function runGate(step: WorkplanStep, ctx: WorkplanRunContext, view: Record<string, StepView>, start: number): Promise<StepResult> {
  const check = step.gate?.check;
  if (check && evaluateCondition(check, view)) {
    return result(step, "succeeded", `gate passed: ${check}`, 0, start);
  }
  if (check && (step.gate?.onFail ?? "fail") === "fail") {
    return result(step, "failed", `gate check failed: ${check}`, 1, start);
  }
  if (!ctx.awaitApproval) {
    return result(step, "failed", "gate needs approval, but this run cannot pause for it", 1, start);
  }
  const decision = await ctx.awaitApproval({
    stepId: step.id,
    stepName: step.name,
    message: step.gate?.message ?? (check ? `Check failed: ${check}. Approve to continue?` : `Approve "${step.name}" to continue?`),
  });
  const by = decision.by ? ` by ${decision.by}` : "";
  return decision.approved
    ? result(step, "succeeded", `approved${by}${decision.reason ? `: ${decision.reason}` : ""}`, 0, start)
    : result(step, "failed", `rejected${by}${decision.reason ? `: ${decision.reason}` : ""}`, 1, start);
}

/** Runs one step. Never throws: failures come back as a failed StepResult. */
async function executeStep(
  step: WorkplanStep,
  payload: Record<string, unknown>,
  ctx: WorkplanRunContext,
  view: Record<string, StepView>,
): Promise<StepResult> {
  const start = Date.now();
  try {
    if (step.adapter === "gate") {
      return await runGate(step, ctx, view, start);
    }
    if (step.provider && INLINE_PROVIDERS.has(step.provider)) {
      const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
      return result(step, "succeeded", await runInlineStep({ ...step, payload }, prompt), 0, start);
    }
    const node = await ctx.resolveNode(step.requires ?? [], step.provider);
    const outcome = await node.execute({ ...step, payload });
    const failed = outcome.status === "failed" || outcome.exitCode !== 0;
    return { ...outcome, stepId: step.id, status: failed ? "failed" : "succeeded" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const links = err instanceof StepExecutionError ? err.links : {};
    return {
      ...result(step, "failed", links.output ? `${links.output}\n${message}` : message, links.exitCode ?? 1, start),
      taskId: links.taskId,
      runId: links.runId,
    };
  }
}

function skipped(step: WorkplanStep, reason: string): StepResult {
  return { stepId: step.id, output: reason, exitCode: 0, durationMs: 0, status: "skipped" };
}

function finalStatus(plan: Workplan, results: StepResult[]): WorkplanStatus {
  const byId = new Map(plan.steps.map((step) => [step.id, step]));
  const failures = results.filter((r) => r.status === "failed");
  if (failures.some((r) => !byId.get(r.stepId)?.continueOnError)) {
    return "step_failed";
  }
  return failures.length > 0 ? "failed" : "completed";
}

/**
 * Runs a workplan. Plans where no step declares `dependsOn` run in order, as they always have:
 * `{{prevOutput}}` carries a `dest: "next"` output forward and a failure stops the run unless the
 * step sets `continueOnError`. Plans with dependencies run as a graph: ready steps run concurrently
 * (up to `maxParallel`), and dependents of a failed or skipped step are skipped while other
 * branches carry on. Both modes support `when:`, gate steps and `{{steps.<id>.output}}`.
 */
export class DagWorkplanRunner implements WorkplanRunner {
  async run(plan: Workplan, ctx: WorkplanRunContext): Promise<WorkplanResult> {
    validateWorkplan(plan);
    return isGraphPlan(plan) ? this.runGraph(plan, ctx) : this.runInOrder(plan, ctx);
  }

  private async record(
    step: WorkplanStep,
    stepResult: StepResult,
    ctx: WorkplanRunContext,
    results: StepResult[],
    view: Record<string, StepView>,
  ): Promise<void> {
    results.push(stepResult);
    view[step.id] = { output: stepResult.output, exitCode: stepResult.exitCode, status: stepResult.status ?? "succeeded" };
    await ctx.onStepResult?.(step, stepResult);
    const dest = step.output?.dest ?? "stdout";
    if (stepResult.status === "failed" || (stepResult.status === "succeeded" && dest !== "next")) {
      ctx.emitResult(step.id, step.name, stepResult.output);
    }
  }

  private async runInOrder(plan: Workplan, ctx: WorkplanRunContext): Promise<WorkplanResult> {
    const results: StepResult[] = [];
    const view: Record<string, StepView> = {};
    let prevOutput = "";

    for (const step of plan.steps) {
      if (step.when && !evaluateCondition(step.when, view)) {
        await this.record(step, skipped(step, `condition not met: ${step.when}`), ctx, results, view);
        continue;
      }
      const payload = applyTemplate(step.payload, prevOutput || undefined, view);
      const stepResult = await executeStep(step, payload, ctx, view);
      await this.record(step, stepResult, ctx, results, view);

      if (stepResult.status === "failed") {
        if (!step.continueOnError) {
          return { planId: plan.id, status: "step_failed", steps: results, succeeded: false };
        }
        prevOutput = "";
        continue;
      }
      prevOutput = (step.output?.dest ?? "stdout") === "next" ? stepResult.output : "";
    }

    const status = finalStatus(plan, results);
    return { planId: plan.id, status, steps: results, succeeded: status === "completed" };
  }

  private async runGraph(plan: Workplan, ctx: WorkplanRunContext): Promise<WorkplanResult> {
    const results: StepResult[] = [];
    const view: Record<string, StepView> = {};
    const byId = new Map(plan.steps.map((step) => [step.id, step]));
    const finished = new Map<string, StepResult>();
    const running = new Map<string, Promise<void>>();
    const maxParallel = plan.maxParallel ?? DEFAULT_MAX_PARALLEL;
    let pending = [...plan.steps];

    const start = (step: WorkplanStep): void => {
      const deps = step.dependsOn ?? [];
      const only = deps.length === 1 ? finished.get(deps[0]) : undefined;
      const carried = only && only.status === "succeeded" && byId.get(deps[0])?.output?.dest === "next" ? only.output : undefined;
      const payload = applyTemplate(step.payload, carried, view);
      running.set(
        step.id,
        executeStep(step, payload, ctx, view).then(async (stepResult) => {
          finished.set(step.id, stepResult);
          await this.record(step, stepResult, ctx, results, view);
          running.delete(step.id);
        }),
      );
    };

    while (pending.length > 0 || running.size > 0) {
      let progressed = true;
      while (progressed) {
        progressed = false;
        for (const step of [...pending]) {
          const deps = step.dependsOn ?? [];
          if (!deps.every((dep) => finished.has(dep))) {
            continue;
          }
          const blocker = deps.find((dep) => {
            const depResult = finished.get(dep)!;
            return depResult.status === "skipped" || (depResult.status === "failed" && !byId.get(dep)?.continueOnError);
          });
          let outcome: StepResult | undefined;
          if (blocker) {
            outcome = skipped(step, `skipped because "${blocker}" ${finished.get(blocker)!.status === "failed" ? "failed" : "was skipped"}`);
          } else if (step.when && !evaluateCondition(step.when, view)) {
            outcome = skipped(step, `condition not met: ${step.when}`);
          } else if (running.size >= maxParallel) {
            continue;
          }
          pending = pending.filter((candidate) => candidate !== step);
          progressed = true;
          if (outcome) {
            finished.set(step.id, outcome);
            await this.record(step, outcome, ctx, results, view);
          } else {
            start(step);
          }
        }
      }
      if (running.size === 0) {
        break;
      }
      await Promise.race(running.values());
    }

    const status = finalStatus(plan, results);
    return { planId: plan.id, status, steps: results, succeeded: status === "completed" };
  }
}

/** The original name, kept for existing callers. It now also runs graph plans. */
export class SequentialWorkplanRunner extends DagWorkplanRunner {}
