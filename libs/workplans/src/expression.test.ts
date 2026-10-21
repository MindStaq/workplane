import assert from "node:assert/strict";
import { test } from "node:test";
import { conditionReferences, evaluateCondition } from "./expression.js";

const steps = {
  tests: { output: "3 passed, 1 FAIL\n", exitCode: 1, status: "failed" },
  "build-web": { output: "ok\n", exitCode: 0, status: "succeeded" },
};

test("comparisons over exit codes, outputs and statuses", () => {
  assert.equal(evaluateCondition("steps.tests.exitCode != 0", steps), true);
  assert.equal(evaluateCondition("steps.tests.exitCode == 0", steps), false);
  assert.equal(evaluateCondition("steps.tests.exitCode >= 1", steps), true);
  assert.equal(evaluateCondition("steps.build-web.output == 'ok'", steps), true, "outputs are compared trimmed");
  assert.equal(evaluateCondition('steps.tests.output contains "FAIL"', steps), true);
  assert.equal(evaluateCondition("steps.tests.status == 'failed'", steps), true);
  assert.equal(evaluateCondition("steps.tests.exitCode == '1'", steps), true, "numeric strings compare as numbers");
});

test("logical operators, negation, parentheses and literals", () => {
  assert.equal(evaluateCondition("steps.tests.exitCode != 0 && steps.build-web.exitCode == 0", steps), true);
  assert.equal(evaluateCondition("!(steps.tests.exitCode == 0) || false", steps), true);
  assert.equal(evaluateCondition("steps.tests.exitCode > -1", steps), true);
  assert.equal(evaluateCondition("true", steps), true);
  assert.equal(evaluateCondition("steps.build-web.output", steps), true, "a non-empty output is truthy");
  assert.equal(evaluateCondition("steps.missing.output == null", steps), true);
});

test("syntax errors are reported with the expression", () => {
  assert.throws(() => evaluateCondition("steps.tests.exitCode ==", steps), /invalid condition "steps.tests.exitCode ==": unexpected end/);
  assert.throws(() => evaluateCondition("process.exit(1)", steps), /unknown reference "process.exit"/);
  assert.throws(() => evaluateCondition("steps.tests.exitCode = 1", steps), /unexpected character "="/);
  assert.throws(() => evaluateCondition("", steps), /empty expression/);
});

test("conditionReferences lists the steps an expression reads", () => {
  assert.deepEqual(conditionReferences("steps.a.exitCode == 0 && (steps.b.output contains 'x' || steps.a.status == 'ok')").sort(), ["a", "b"]);
});
