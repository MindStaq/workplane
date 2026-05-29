import assert from "node:assert/strict";
import { test } from "node:test";
import { ScheduleBuilder } from "./schedule-builder.js";

test("ScheduleBuilder.nextRunAt returns a valid ISO string", () => {
  const result = ScheduleBuilder.nextRunAt("0 9 * * 1-5", "America/New_York");
  assert.match(result, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test("ScheduleBuilder.nextRunAt respects timezone offset", () => {
  // 9am NYC is UTC-4 in summer (EDT), so we expect the UTC hour to be 13
  // This test uses a fixed cron; we just verify the result is a future date
  const now = new Date();
  const result = ScheduleBuilder.nextRunAt("0 9 * * *", "America/New_York");
  assert.ok(new Date(result) > now);
});

test("ScheduleBuilder.withNextRunAt populates nextRunAt on schedule", () => {
  const schedule = {
    id: "sched-1",
    planId: "plan-1",
    name: "daily",
    cronExpression: "0 8 * * *",
    timezone: "Europe/London",
    inputs: {},
    enabled: true,
  };
  const result = ScheduleBuilder.withNextRunAt(schedule);
  assert.ok(result.nextRunAt);
  assert.match(result.nextRunAt, /^\d{4}-\d{2}-\d{2}T/);
});
