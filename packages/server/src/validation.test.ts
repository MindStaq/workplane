import assert from "node:assert/strict";
import { test } from "node:test";
import { validateCreateTaskInput, validateInputEvent } from "./validation.js";

test("validateCreateTaskInput accepts ollama inference task", () => {
  const input = validateCreateTaskInput({
    kind: "inference.batch",
    adapter: "ollama",
    requires: ["ollama"],
    payload: { model: "llama3", prompt: "hello" },
  });
  assert.equal(input.adapter, "ollama");
});

test("validateCreateTaskInput accepts codex harness task", () => {
  const input = validateCreateTaskInput({
    kind: "agent.run",
    adapter: "codex",
    requires: ["codex", "git"],
    payload: { repo: "git@github.com:org/app.git", prompt: "fix tests" },
  });
  assert.equal(input.adapter, "codex");
});

test("validateInputEvent accepts stdin event", () => {
  const event = validateInputEvent({ kind: "stdin", payload: { data: "hello\n" } });
  assert.equal(event.kind, "stdin");
  assert.deepEqual(event.payload, { data: "hello\n" });
});

test("validateInputEvent accepts signal event", () => {
  const event = validateInputEvent({ kind: "signal", payload: { signal: "SIGTERM" } });
  assert.equal(event.kind, "signal");
});

test("validateInputEvent accepts resize event", () => {
  const event = validateInputEvent({ kind: "resize", payload: { rows: 24, cols: 80 } });
  assert.equal(event.kind, "resize");
});

test("validateInputEvent rejects unknown kind", () => {
  assert.throws(() => validateInputEvent({ kind: "unknown", payload: {} }));
});

test("validateInputEvent rejects stdin with missing data field", () => {
  assert.throws(() => validateInputEvent({ kind: "stdin", payload: {} }));
});

test("validateInputEvent rejects resize with non-integer rows", () => {
  assert.throws(() => validateInputEvent({ kind: "resize", payload: { rows: 1.5, cols: 80 } }));
});
