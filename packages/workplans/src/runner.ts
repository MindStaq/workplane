import type { Workplan, WorkplanResult, WorkplanRunner, WorkplanRunContext, StepResult, WorkplanStep } from "./types.js";
import { applyTemplate } from "./template.js";

const INLINE_PROVIDERS = new Set(["anthropic", "openai", "ollama", "shell", "file"]);

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

export class SequentialWorkplanRunner implements WorkplanRunner {
  async run(plan: Workplan, ctx: WorkplanRunContext): Promise<WorkplanResult> {
    const results: StepResult[] = [];
    let prevOutput = "";
    let planSucceeded = true;

    for (const step of plan.steps) {
      const payload = prevOutput ? applyTemplate(step.payload, prevOutput) : step.payload;
      const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
      const start = Date.now();
      let output = "";
      let exitCode = 0;

      try {
        if (step.provider && INLINE_PROVIDERS.has(step.provider)) {
          output = await runInlineStep({ ...step, payload }, prompt);
        } else {
          const node = await ctx.resolveNode(step.requires ?? [], step.provider);
          const result = await node.execute({ ...step, payload });
          output = result.output;
          exitCode = result.exitCode;
        }
      } catch (err) {
        exitCode = 1;
        output = err instanceof Error ? err.message : String(err);
        planSucceeded = false;

        const stepResult: StepResult = {
          stepId: step.id,
          output,
          exitCode,
          durationMs: Date.now() - start,
        };
        results.push(stepResult);
        ctx.emitResult(step.id, step.name, output);

        if (!step.continueOnError) {
          return {
            planId: plan.id,
            status: "step_failed",
            steps: results,
            succeeded: false,
          };
        }
        prevOutput = "";
        continue;
      }

      const dest = step.output?.dest ?? "stdout";
      const stepResult: StepResult = {
        stepId: step.id,
        output,
        exitCode,
        durationMs: Date.now() - start,
      };
      results.push(stepResult);

      if (dest === "stdout" || dest === "artifact") {
        ctx.emitResult(step.id, step.name, output);
        prevOutput = "";
      } else if (dest === "next") {
        prevOutput = output;
      }
    }

    return {
      planId: plan.id,
      status: planSucceeded ? "completed" : "failed",
      steps: results,
      succeeded: planSucceeded,
    };
  }
}
