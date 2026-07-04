import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runMigration } from "./migration.js";
import { createStore } from "./client.js";

test("deleteWorkplanSchedule succeeds when runs reference the schedule", async () => {
  const dir = mkdtempSync(join(tmpdir(), "workplane-sched-delete-"));
  const dbPath = join(dir, "test.db");

  try {
    await runMigration(`sqlite://${dbPath}`);
    const { store, close } = createStore(`sqlite://${dbPath}`);

    const schedule = await store.createWorkplanSchedule({
      planId: "hello",
      name: "test",
      cronExpression: "*/1 * * * *",
      timezone: "UTC",
      nextRunAt: new Date().toISOString(),
    });

    const run = await store.tryCreateWorkplanRun({
      scheduleId: schedule.id,
      planId: "hello",
      planName: "test",
      idempotencyKey: `${schedule.id}:manual`,
    });
    assert.ok(run);

    const deleted = await store.deleteWorkplanSchedule(schedule.id);
    assert.equal(deleted, true);
    assert.equal(await store.getWorkplanSchedule(schedule.id), null);

    const runs = await store.listWorkplanRuns();
    assert.equal(runs.length, 1);
    assert.equal(runs[0]?.scheduleId, null);

    await close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
