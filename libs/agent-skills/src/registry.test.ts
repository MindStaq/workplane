import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultRegistry, SkillRegistry } from "./skills/index.js";

test("createDefaultRegistry includes code-review and summarize-file", () => {
  const registry = createDefaultRegistry();
  const names = registry.list().map((s) => s.name);
  assert.ok(names.includes("code-review"));
  assert.ok(names.includes("summarize-file"));
});

test("SkillRegistry.get returns undefined for unknown skill", () => {
  const registry = new SkillRegistry();
  assert.equal(registry.get("nonexistent"), undefined);
});

test("SkillRegistry.list returns all registered skills", () => {
  const registry = new SkillRegistry();
  registry.register({ name: "a", description: "skill a", buildPlan: () => ({ id: "a", name: "A", steps: [] }) });
  registry.register({ name: "b", description: "skill b", buildPlan: () => ({ id: "b", name: "B", steps: [] }) });
  assert.equal(registry.list().length, 2);
});

test("code-review skill buildPlan accepts repo and model options", () => {
  const registry = createDefaultRegistry();
  const skill = registry.get("code-review")!;
  const plan = skill.buildPlan({ repo: "/tmp/repo", model: "claude-opus-4-8" });
  assert.equal(plan.steps[0].payload.cwd, "/tmp/repo");
  assert.equal(plan.steps[2].model, "claude-opus-4-8");
});

test("summarize-file skill buildPlan throws without --file", () => {
  const registry = createDefaultRegistry();
  const skill = registry.get("summarize-file")!;
  assert.throws(() => skill.buildPlan({}), /--file is required/);
});
