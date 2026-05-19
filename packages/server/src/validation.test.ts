import assert from "node:assert/strict";
import { test } from "node:test";
import { validateCreateTaskInput } from "./validation.js";

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
