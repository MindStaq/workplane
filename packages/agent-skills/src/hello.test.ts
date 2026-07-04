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
