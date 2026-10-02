import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeFilePlan } from "./skills/summarize-file.js";

test("summarizeFilePlan has two steps", () => {
  const plan = summarizeFilePlan({ filePath: "/tmp/test.txt" });
  assert.equal(plan.steps.length, 2);
  assert.equal(plan.steps[0].id, "read");
  assert.equal(plan.steps[1].id, "summarize");
});

test("summarizeFilePlan read step uses file provider", () => {
  const plan = summarizeFilePlan({ filePath: "/tmp/test.txt" });
  assert.equal(plan.steps[0].provider, "file");
  assert.equal(plan.steps[0].payload.path, "/tmp/test.txt");
});

test("summarizeFilePlan read step chains to next", () => {
  const plan = summarizeFilePlan({ filePath: "/tmp/test.txt" });
  assert.equal(plan.steps[0].output?.dest, "next");
});

test("summarizeFilePlan defaults to ollama provider", () => {
  const plan = summarizeFilePlan({ filePath: "/tmp/test.txt" });
  assert.equal(plan.steps[1].provider, "ollama");
});

test("summarizeFilePlan respects provider override", () => {
  const plan = summarizeFilePlan({ filePath: "/tmp/test.txt", provider: "anthropic", model: "claude-haiku-4-5-20251001" });
  assert.equal(plan.steps[1].provider, "anthropic");
  assert.equal(plan.steps[1].model, "claude-haiku-4-5-20251001");
});
