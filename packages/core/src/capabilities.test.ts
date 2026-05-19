import assert from "node:assert/strict";
import { test } from "node:test";
import { hasRequiredCapabilities } from "./capabilities.js";

test("hasRequiredCapabilities returns true when node has all required caps", () => {
  assert.equal(hasRequiredCapabilities(["shell", "git", "ollama"], ["shell", "git"]), true);
});

test("hasRequiredCapabilities returns false when node is missing a cap", () => {
  assert.equal(hasRequiredCapabilities(["shell"], ["shell", "ollama"]), false);
});

test("hasRequiredCapabilities handles empty requires", () => {
  assert.equal(hasRequiredCapabilities(["shell"], []), true);
});
