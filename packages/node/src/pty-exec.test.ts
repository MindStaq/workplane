import assert from "node:assert/strict";
import { test } from "node:test";
import { createPtyExec } from "./pty-exec.js";

const NO_TTY = !process.stdout.isTTY || process.env.CI === "true" || process.env.CI === "1";

const stubContext = {
  runId: "test-run",
  taskId: "test-task",
  workspacePath: "/tmp",
  log: async () => {},
  exec: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
  ensureWorkspace: async (..._segments: string[]) => "/tmp",
  emitArtifact: async () => {},
};

test("createPtyExec writeStdin is a no-op when no child is active", () => {
  const { writeStdin } = createPtyExec(stubContext);
  assert.doesNotThrow(() => writeStdin("hello\n"));
});

test("createPtyExec kill is a no-op when no child is active", () => {
  const { kill } = createPtyExec(stubContext);
  assert.doesNotThrow(() => kill());
  assert.doesNotThrow(() => kill("SIGKILL"));
});

test("createPtyExec ptyResize is a no-op when no child is active", () => {
  const { ptyResize } = createPtyExec(stubContext);
  assert.doesNotThrow(() => ptyResize(24, 80));
});

test(
  "createPtyExec runs a command and captures output",
  { skip: NO_TTY ? "skipped: no TTY available" : false },
  async () => {
    const logs: string[] = [];
    const ctx = {
      ...stubContext,
      log: async (_stream: string, message: string) => {
        logs.push(message);
      },
    };
    const { exec } = createPtyExec(ctx);
    const result = await exec("echo", ["hello from pty"]);
    assert.equal(result.exitCode, 0);
    const combined = logs.join("");
    assert.ok(combined.includes("hello from pty"), `expected output in logs, got: ${combined}`);
  },
);
