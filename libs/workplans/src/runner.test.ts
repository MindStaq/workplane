import assert from "node:assert/strict";
import { test } from "node:test";
import { SequentialWorkplanRunner } from "./runner.js";
import type { Workplan, WorkplanRunContext, NodeHandle, WorkplanStep, StepResult } from "./types.js";

function makeCtx(overrides: Partial<WorkplanRunContext> = {}): WorkplanRunContext & { emitted: string[] } {
  const emitted: string[] = [];
  return {
    emitted,
    async resolveNode(): Promise<NodeHandle> {
      return {
        async execute(step: WorkplanStep): Promise<StepResult> {
          return { stepId: step.id, output: `node:${step.id}`, exitCode: 0, durationMs: 1 };
        },
      };
    },
    emitResult(_id: string, name: string, output: string) {
      emitted.push(`${name}:${output}`);
    },
    ...overrides,
  };
}

test("SequentialWorkplanRunner executes steps in order", async () => {
  const plan: Workplan = {
    id: "plan-1",
    name: "test",
    steps: [
      { id: "s1", name: "step-1", adapter: "shell", payload: {} },
      { id: "s2", name: "step-2", adapter: "shell", payload: {} },
    ],
  };
  const ctx = makeCtx();
  const result = await new SequentialWorkplanRunner().run(plan, ctx);
  assert.equal(result.succeeded, true);
  assert.equal(result.status, "completed");
  assert.equal(result.steps.length, 2);
  assert.equal(result.steps[0].stepId, "s1");
  assert.equal(result.steps[1].stepId, "s2");
  assert.deepEqual(ctx.emitted, ["step-1:node:s1", "step-2:node:s2"]);
});

test("SequentialWorkplanRunner halts on step failure by default", async () => {
  const plan: Workplan = {
    id: "plan-1",
    name: "test",
    steps: [
      { id: "fail", name: "fail-step", adapter: "shell", payload: {} },
      { id: "skip", name: "skip-step", adapter: "shell", payload: {} },
    ],
  };
  const ctx = makeCtx({
    async resolveNode(): Promise<NodeHandle> {
      return {
        async execute(step: WorkplanStep): Promise<StepResult> {
          if (step.id === "fail") throw new Error("oops");
          return { stepId: step.id, output: "ok", exitCode: 0, durationMs: 1 };
        },
      };
    },
  });
  const result = await new SequentialWorkplanRunner().run(plan, ctx);
  assert.equal(result.succeeded, false);
  assert.equal(result.status, "step_failed");
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].exitCode, 1);
});

test("SequentialWorkplanRunner continues when continueOnError is set", async () => {
  const plan: Workplan = {
    id: "plan-1",
    name: "test",
    steps: [
      { id: "fail", name: "fail-step", adapter: "shell", payload: {}, continueOnError: true },
      { id: "next", name: "next-step", adapter: "shell", payload: {} },
    ],
  };
  const ctx = makeCtx({
    async resolveNode(): Promise<NodeHandle> {
      return {
        async execute(step: WorkplanStep): Promise<StepResult> {
          if (step.id === "fail") throw new Error("oops");
          return { stepId: step.id, output: "ok", exitCode: 0, durationMs: 1 };
        },
      };
    },
  });
  const result = await new SequentialWorkplanRunner().run(plan, ctx);
  assert.equal(result.steps.length, 2);
  assert.equal(result.steps[1].stepId, "next");
});

test("SequentialWorkplanRunner chains output via dest:next", async () => {
  const plan: Workplan = {
    id: "plan-1",
    name: "test",
    steps: [
      { id: "s1", name: "step-1", adapter: "shell", payload: {}, output: { dest: "next" } },
      { id: "s2", name: "step-2", adapter: "shell", payload: { prompt: "review: {{prevOutput}}" } },
    ],
  };
  let capturedPayload: Record<string, unknown> = {};
  const ctx = makeCtx({
    async resolveNode(): Promise<NodeHandle> {
      return {
        async execute(step: WorkplanStep): Promise<StepResult> {
          capturedPayload = step.payload;
          return { stepId: step.id, output: "result", exitCode: 0, durationMs: 1 };
        },
      };
    },
  });
  await new SequentialWorkplanRunner().run(plan, ctx);
  assert.equal(capturedPayload.prompt, "review: result");
});

test("SequentialWorkplanRunner uses inline provider when step.provider is set", async () => {
  const fakeFn = async () => "ai-response";
  const plan: Workplan = {
    id: "plan-1",
    name: "test",
    steps: [
      {
        id: "ai",
        name: "ai-step",
        adapter: "anthropic",
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
        payload: { prompt: "hello" },
      },
    ],
  };
  const ctx = makeCtx();

  // Patch inline execution by replacing the dynamic import — not practical in node:test
  // Instead verify no resolveNode is called when provider is inline
  let nodeResolved = false;
  ctx.resolveNode = async () => {
    nodeResolved = true;
    return { execute: async () => ({ stepId: "ai", output: "", exitCode: 0, durationMs: 0 }) };
  };

  // We can't mock dynamic imports easily; verify the inline path doesn't call resolveNode
  // by using a provider that will throw (no API key in test env) vs resolveNode path
  try {
    await new SequentialWorkplanRunner().run(plan, ctx);
  } catch {
    // expected: no ANTHROPIC_API_KEY in test env
  }
  assert.equal(nodeResolved, false);
});
