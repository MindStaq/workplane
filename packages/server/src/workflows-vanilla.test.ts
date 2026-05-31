import assert from "node:assert/strict";
import { test } from "node:test";
import { VanillaWorkflows } from "./workflows-vanilla.js";

function makeStore(overrides: Partial<Record<string, (...args: unknown[]) => unknown>> = {}) {
  return {
    createTask: overrides.createTask ?? (async () => ({ id: "t1" })),
    retryTask: overrides.retryTask ?? (async () => ({ id: "t1" })),
    cancelTask: overrides.cancelTask ?? (async () => ({ id: "t1" })),
    updateRunStatus: overrides.updateRunStatus ?? (async () => ({ id: "r1" })),
    appendRunLogs: overrides.appendRunLogs ?? (async () => 2),
    createArtifact: overrides.createArtifact ?? (async () => ({ id: "a1" })),
    appendInputEvent: overrides.appendInputEvent ?? (async () => ({ id: 1 })),
    markInputDelivered: overrides.markInputDelivered ?? (async () => undefined),
  } as unknown as import("../../db/src/store-interface.js").WorkplaneStore;
}

test("VanillaWorkflows.createTask delegates to store", async () => {
  const expected = { id: "task-1", kind: "test", adapter: "shell" };
  const store = makeStore({ createTask: async () => expected });
  const wf = new VanillaWorkflows(store);
  const result = await wf.createTask({ kind: "test", adapter: "shell", payload: {} });
  assert.deepEqual(result, expected);
});

test("VanillaWorkflows.retryTask returns null when store returns null", async () => {
  const store = makeStore({ retryTask: async () => null });
  const wf = new VanillaWorkflows(store);
  const result = await wf.retryTask("task-1");
  assert.equal(result, null);
});

test("VanillaWorkflows.cancelTask returns task when cancellable", async () => {
  const expected = { id: "task-1", status: "cancelled" };
  const store = makeStore({ cancelTask: async () => expected });
  const wf = new VanillaWorkflows(store);
  const result = await wf.cancelTask("task-1");
  assert.deepEqual(result, expected);
});

test("VanillaWorkflows.updateRunStatus delegates to store", async () => {
  const expected = { id: "run-1", status: "succeeded" };
  const store = makeStore({ updateRunStatus: async () => expected });
  const wf = new VanillaWorkflows(store);
  const result = await wf.updateRunStatus("run-1", "succeeded");
  assert.deepEqual(result, expected);
});

test("VanillaWorkflows.appendRunLogs returns inserted count", async () => {
  const store = makeStore({ appendRunLogs: async () => 3 });
  const wf = new VanillaWorkflows(store);
  const result = await wf.appendRunLogs("run-1", []);
  assert.equal(result, 3);
});

test("VanillaWorkflows.createArtifact delegates to store", async () => {
  const expected = { id: "artifact-1", name: "diff.patch" };
  const store = makeStore({ createArtifact: async () => expected });
  const wf = new VanillaWorkflows(store);
  const result = await wf.createArtifact("run-1", { type: "diff", name: "diff.patch", path: "/tmp/diff.patch" });
  assert.deepEqual(result, expected);
});

test("VanillaWorkflows.appendInputEvent delegates to store", async () => {
  const expected = { id: 5, runId: "run-1", sequence: 1, kind: "stdin" };
  const store = makeStore({ appendInputEvent: async () => expected });
  const wf = new VanillaWorkflows(store);
  const result = await wf.appendInputEvent("run-1", { kind: "stdin", payload: { data: "hi\n" } });
  assert.deepEqual(result, expected);
});

test("VanillaWorkflows.markInputDelivered delegates to store", async () => {
  let called = false;
  const store = makeStore({ markInputDelivered: async () => { called = true; } });
  const wf = new VanillaWorkflows(store);
  await wf.markInputDelivered("run-1", 1);
  assert.equal(called, true);
});
