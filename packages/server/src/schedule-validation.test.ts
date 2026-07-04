import assert from "node:assert/strict";
import { test } from "node:test";
import { validateCreateSchedule, validateUpdateSchedule } from "./schedule-validation.js";

test("validateCreateSchedule accepts schedule payload", () => {
  const body = validateCreateSchedule({
    planId: "code-review",
    name: "Daily review",
    cronExpression: "0 9 * * 1-5",
    timezone: "America/New_York",
    inputs: { repo: "." },
  });
  assert.equal(body.planId, "code-review");
});

test("validateUpdateSchedule accepts partial updates", () => {
  const body = validateUpdateSchedule({ enabled: false });
  assert.equal(body.enabled, false);
});
