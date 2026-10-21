import assert from "node:assert/strict";
import { test } from "node:test";
import { DagWorkplanRunner, SequentialWorkplanRunner } from "./runner.js";
import { StepExecutionError } from "./errors.js";
import type { NodeHandle, StepResult, Workplan, WorkplanRunContext, WorkplanStep } from "./types.js";

interface Recorder {
  started: string[];
  maxConcurrent: number;
  payloads: Record<string, Record<string, unknown>>;
  reported: Array<[string, string | undefined]>;
}

/** A context whose node runs each step after `delays[id]` ms, failing the IDs in `fail`. */
function makeCtx(options: { delays?: Record<string, number>; fail?: string[]; exitCodes?: Record<string, number> } = {}) {
  const recorder: Recorder = { started: [], maxConcurrent: 0, payloads: {}, reported: [] };
  let active = 0;
  const ctx: WorkplanRunContext = {
    async resolveNode(): Promise<NodeHandle> {
      return {
        async execute(step: WorkplanStep): Promise<StepResult> {
          recorder.started.push(step.id);
          recorder.payloads[step.id] = step.payload;
          active += 1;
          recorder.maxConcurrent = Math.max(recorder.maxConcurrent, active);
          await new Promise((resolve) => setTimeout(resolve, options.delays?.[step.id] ?? 5));
          active -= 1;
          if (options.fail?.includes(step.id)) {
            throw new StepExecutionError(`${step.id} broke`, { taskId: `task_${step.id}`, runId: `run_${step.id}`, exitCode: 2 });
          }
          return { stepId: step.id, output: `out:${step.id}`, exitCode: options.exitCodes?.[step.id] ?? 0, durationMs: 1 };
        },
      };
    },
    emitResult() {},
    onStepResult(step, result) {
      recorder.reported.push([step.id, result.status]);
    },
  };
  return { ctx, recorder };
}

const step = (id: string, extra: Partial<WorkplanStep> = {}): WorkplanStep => ({
  id,
  name: id.toUpperCase(),
  adapter: "shell",
  payload: {},
  ...extra,
});

test("diamond DAG: B and C run concurrently after A, and D sees both outputs", async () => {
  const plan: Workplan = {
    id: "diamond",
    name: "Diamond",
    steps: [
      step("a"),
      step("b", { dependsOn: ["a"] }),
      step("c", { dependsOn: ["a"] }),
      step("d", { dependsOn: ["b", "c"], payload: { prompt: "{{steps.b.output}} + {{steps.c.output}}" } }),
    ],
  };
  const { ctx, recorder } = makeCtx({ delays: { b: 30, c: 30 } });
  const result = await new DagWorkplanRunner().run(plan, ctx);

  assert.equal(result.status, "completed");
  assert.equal(result.succeeded, true);
  assert.equal(recorder.started[0], "a");
  assert.deepEqual(recorder.started.slice(1, 3).sort(), ["b", "c"]);
  assert.equal(recorder.started[3], "d");
  assert.equal(recorder.maxConcurrent, 2);
  assert.equal(recorder.payloads.d.prompt, "out:b + out:c");
  assert.deepEqual(recorder.reported.map(([id]) => id).sort(), ["a", "b", "c", "d"]);
});

test("maxParallel caps how many ready steps run at once", async () => {
  const plan: Workplan = {
    id: "fan",
    name: "Fan out",
    maxParallel: 2,
    steps: [step("root"), ...["x1", "x2", "x3", "x4", "x5"].map((id) => step(id, { dependsOn: ["root"] }))],
  };
  const { ctx, recorder } = makeCtx({ delays: { x1: 15, x2: 15, x3: 15, x4: 15, x5: 15 } });
  const result = await new DagWorkplanRunner().run(plan, ctx);
  assert.equal(result.status, "completed");
  assert.equal(recorder.maxConcurrent, 2);
});

test("a failed step skips its dependents while other branches finish; links survive the failure", async () => {
  const plan: Workplan = {
    id: "branches",
    name: "Branches",
    steps: [step("a"), step("bad", { dependsOn: ["a"] }), step("after-bad", { dependsOn: ["bad"] }), step("good", { dependsOn: ["a"] })],
  };
  const { ctx, recorder } = makeCtx({ fail: ["bad"] });
  const result = await new DagWorkplanRunner().run(plan, ctx);

  assert.equal(result.status, "step_failed");
  assert.equal(result.succeeded, false);
  const byId = Object.fromEntries(result.steps.map((s) => [s.stepId, s]));
  assert.equal(byId.good.status, "succeeded");
  assert.equal(byId.bad.status, "failed");
  assert.equal(byId.bad.exitCode, 2);
  assert.equal(byId.bad.taskId, "task_bad");
  assert.equal(byId.bad.runId, "run_bad");
  assert.equal(byId["after-bad"].status, "skipped");
  assert.match(byId["after-bad"].output, /"bad" failed/);
  assert.ok(!recorder.started.includes("after-bad"));
});

test("continueOnError lets dependents run, and when: reads the failed step's exit code", async () => {
  const plan: Workplan = {
    id: "tests",
    name: "Tests",
    steps: [
      step("tests", { continueOnError: true }),
      step("report-failure", { dependsOn: ["tests"], when: "steps.tests.exitCode != 0" }),
      step("deploy", { dependsOn: ["tests"], when: "steps.tests.exitCode == 0" }),
    ],
  };
  const { ctx } = makeCtx({ fail: ["tests"] });
  const result = await new DagWorkplanRunner().run(plan, ctx);
  const byId = Object.fromEntries(result.steps.map((s) => [s.stepId, s]));
  assert.equal(byId["report-failure"].status, "succeeded");
  assert.equal(byId.deploy.status, "skipped");
  assert.equal(result.status, "failed");
});

test("a returned non-zero exit code fails the step", async () => {
  const plan: Workplan = { id: "p", name: "p", steps: [step("a"), step("b")] };
  const { ctx } = makeCtx({ exitCodes: { a: 3 } });
  const result = await new SequentialWorkplanRunner().run(plan, ctx);
  assert.equal(result.status, "step_failed");
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].exitCode, 3);
});

test("sequential plans support when: and keep running after a skipped step", async () => {
  const plan: Workplan = {
    id: "seq",
    name: "Sequential",
    steps: [step("a"), step("b", { when: "steps.a.output == 'nope'" }), step("c", { payload: { text: "{{steps.a.output}}" } })],
  };
  const { ctx, recorder } = makeCtx();
  const result = await new SequentialWorkplanRunner().run(plan, ctx);
  assert.equal(result.status, "completed");
  assert.deepEqual(result.steps.map((s) => [s.stepId, s.status]), [["a", "succeeded"], ["b", "skipped"], ["c", "succeeded"]]);
  assert.equal(recorder.payloads.c.text, "out:a");
});

test("gate with a passing check continues; a failing check fails the step", async () => {
  const passing: Workplan = {
    id: "gate-pass",
    name: "Gate",
    steps: [step("tests"), step("gate", { adapter: "gate", dependsOn: ["tests"], gate: { check: "steps.tests.exitCode == 0" } }), step("ship", { dependsOn: ["gate"] })],
  };
  const pass = await new DagWorkplanRunner().run(passing, makeCtx().ctx);
  assert.equal(pass.status, "completed");

  const failing: Workplan = {
    ...passing,
    steps: [step("tests"), step("gate", { adapter: "gate", dependsOn: ["tests"], gate: { check: "steps.tests.output contains 'FAIL'" } }), step("ship", { dependsOn: ["gate"] })],
  };
  const fail = await new DagWorkplanRunner().run(failing, makeCtx().ctx);
  const byId = Object.fromEntries(fail.steps.map((s) => [s.stepId, s]));
  assert.equal(byId.gate.status, "failed");
  assert.match(byId.gate.output, /gate check failed/);
  assert.equal(byId.ship.status, "skipped");
});

test("approval gates pause for a decision, and fail when the context cannot pause", async () => {
  const plan: Workplan = {
    id: "approval",
    name: "Approval",
    steps: [step("gate", { adapter: "gate", gate: { message: "go?" } }), step("ship")],
  };
  const { ctx } = makeCtx();
  const rejected = await new SequentialWorkplanRunner().run(plan, { ...ctx, awaitApproval: async () => ({ approved: false, reason: "not today" }) });
  assert.equal(rejected.status, "step_failed");
  assert.equal(rejected.steps[0].output, "rejected: not today");

  const cannotPause = await new SequentialWorkplanRunner().run(plan, ctx);
  assert.match(cannotPause.steps[0].output, /cannot pause/);
});

test("the runner rejects a plan with a cycle before running anything", async () => {
  const plan: Workplan = {
    id: "cycle",
    name: "Cycle",
    steps: [step("a", { dependsOn: ["c"] }), step("b", { dependsOn: ["a"] }), step("c", { dependsOn: ["b"] })],
  };
  const { ctx, recorder } = makeCtx();
  await assert.rejects(new DagWorkplanRunner().run(plan, ctx), /dependency cycle: a -> c -> b -> a/);
  assert.equal(recorder.started.length, 0);
});
