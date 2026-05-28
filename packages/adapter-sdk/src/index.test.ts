import assert from "node:assert/strict";
import { test } from "node:test";
import { createCancellableExec } from "./index.js";

const stubContext = {
  runId: "test-run",
  taskId: "test-task",
  workspacePath: "/tmp",
  log: async () => {},
  exec: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
  ensureWorkspace: async (..._segments: string[]) => "/tmp",
  emitArtifact: async () => {},
};

test("createCancellableExec writeStdin is a no-op when no child is active", () => {
  const { writeStdin } = createCancellableExec(stubContext);
  assert.doesNotThrow(() => writeStdin("hello\n"));
});

test("createCancellableExec kill is a no-op when no child is active", () => {
  const { kill } = createCancellableExec(stubContext);
  assert.doesNotThrow(() => kill());
  assert.doesNotThrow(() => kill("SIGKILL"));
});
