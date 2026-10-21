import assert from "node:assert/strict";
import { test } from "node:test";
import { isGraphPlan, validateWorkplan } from "./validate.js";
import type { Workplan, WorkplanStep } from "./types.js";

const step = (id: string, extra: Partial<WorkplanStep> = {}): WorkplanStep => ({ id, name: id, adapter: "shell", payload: {}, ...extra });
const plan = (...steps: WorkplanStep[]): Workplan => ({ id: "p", name: "p", steps });

test("isGraphPlan is true only when a step declares dependencies", () => {
  assert.equal(isGraphPlan(plan(step("a"), step("b"))), false);
  assert.equal(isGraphPlan(plan(step("a"), step("b", { dependsOn: [] }))), false);
  assert.equal(isGraphPlan(plan(step("a"), step("b", { dependsOn: ["a"] }))), true);
});

test("rejects duplicate IDs, unknown and self dependencies", () => {
  assert.throws(() => validateWorkplan(plan(step("a"), step("a"))), /duplicate step id "a"/);
  assert.throws(() => validateWorkplan(plan(step("a", { dependsOn: ["ghost"] }))), /depends on unknown step "ghost"/);
  assert.throws(() => validateWorkplan(plan(step("a", { dependsOn: ["a"] }))), /depends on itself/);
});

test("rejects cycles with the path", () => {
  assert.throws(
    () => validateWorkplan(plan(step("a"), step("b", { dependsOn: ["a", "c"] }), step("c", { dependsOn: ["b"] }))),
    /dependency cycle: b -> c -> b/,
  );
});

test("conditions and templates may only read steps guaranteed to have finished", () => {
  assert.throws(
    () => validateWorkplan(plan(step("a"), step("b", { dependsOn: ["a"] }), step("c", { dependsOn: ["a"], when: "steps.b.exitCode == 0" }))),
    /step "c" when reads step "b", which is not one of its dependencies/,
  );
  assert.throws(
    () => validateWorkplan(plan(step("a", { payload: { prompt: "{{steps.b.output}}" } }), step("b"))),
    /step "a" payload reads step "b", which runs after it/,
  );
  assert.throws(() => validateWorkplan(plan(step("a", { when: "steps.zzz.exitCode == 0" }))), /reads unknown step "zzz"/);
  assert.throws(() => validateWorkplan(plan(step("a", { when: "steps.a.exitCode ==" }))), /step "a" when: invalid condition/);

  validateWorkplan(
    plan(step("a"), step("b", { dependsOn: ["a"] }), step("c", { dependsOn: ["b"], when: "steps.a.exitCode == 0", payload: { x: "{{steps.a.output}}" } })),
  );
});

test("gate settings are checked", () => {
  assert.throws(() => validateWorkplan(plan(step("g", { gate: { check: "true" } }))), /gate steps use adapter "gate"/);
  assert.throws(
    () => validateWorkplan(plan(step("g", { adapter: "gate", gate: { onFail: "maybe" as "fail" } }))),
    /invalid onFail "maybe"/,
  );
  assert.throws(() => validateWorkplan({ ...plan(step("a")), maxParallel: 0 }), /maxParallel/);
});
