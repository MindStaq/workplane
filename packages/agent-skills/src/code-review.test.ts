import assert from "node:assert/strict";
import { test } from "node:test";
import { codeReviewPlan } from "./skills/code-review.js";

test("codeReviewPlan has three steps with correct IDs", () => {
  const plan = codeReviewPlan();
  assert.equal(plan.steps.length, 3);
  assert.equal(plan.steps[0].id, "diff");
  assert.equal(plan.steps[1].id, "summarize");
  assert.equal(plan.steps[2].id, "critique");
});

test("codeReviewPlan step providers are shell, ollama, anthropic", () => {
  const plan = codeReviewPlan();
  assert.equal(plan.steps[0].provider, "shell");
  assert.equal(plan.steps[1].provider, "ollama");
  assert.equal(plan.steps[2].provider, "anthropic");
});

test("codeReviewPlan diff and summarize steps chain via dest:next", () => {
  const plan = codeReviewPlan();
  assert.equal(plan.steps[0].output?.dest, "next");
  assert.equal(plan.steps[1].output?.dest, "next");
  assert.equal(plan.steps[2].output, undefined);
});

test("codeReviewPlan uses provided model for critique step", () => {
  const plan = codeReviewPlan({ model: "claude-opus-4-8" });
  assert.equal(plan.steps[2].model, "claude-opus-4-8");
});

test("codeReviewPlan uses provided repoPath as shell cwd", () => {
  const plan = codeReviewPlan({ repoPath: "/tmp/repo" });
  assert.equal(plan.steps[0].payload.cwd, "/tmp/repo");
});

test("codeReviewPlan uses branch in git diff command when provided", () => {
  const plan = codeReviewPlan({ branch: "main" });
  assert.equal(plan.steps[0].payload.command, "git diff main..HEAD");
});

test("codeReviewPlan defaults to HEAD~1 diff when no branch given", () => {
  const plan = codeReviewPlan();
  assert.equal(plan.steps[0].payload.command, "git diff HEAD~1");
});
