import assert from "node:assert/strict";
import { test } from "node:test";
import { helloPlan } from "./skills/hello.js";

test("helloPlan runs a single shell echo step", () => {
  const plan = helloPlan({ message: "ping" });
  assert.equal(plan.id, "hello");
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0]?.provider, "shell");
  assert.equal(plan.steps[0]?.payload.command, 'echo "ping"');
});

test("helloPlan with fleet dispatches the echo to a node with the shell capability", () => {
  const step = helloPlan({ message: "ping", fleet: true }).steps[0];
  assert.equal(step?.provider, undefined);
  assert.deepEqual(step?.requires, ["shell"]);
  assert.equal(step?.payload.command, 'echo "ping"');
});
