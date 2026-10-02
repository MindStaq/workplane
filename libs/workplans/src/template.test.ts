import assert from "node:assert/strict";
import { test } from "node:test";
import { applyTemplate } from "./template.js";

test("applyTemplate replaces {{prevOutput}} in string values", () => {
  const result = applyTemplate({ prompt: "review: {{prevOutput}}", count: 3 }, "my output");
  assert.equal(result.prompt, "review: my output");
  assert.equal(result.count, 3);
});

test("applyTemplate replaces multiple occurrences", () => {
  const result = applyTemplate({ text: "{{prevOutput}} and {{prevOutput}}" }, "hello");
  assert.equal(result.text, "hello and hello");
});

test("applyTemplate leaves non-string values untouched", () => {
  const nested = { a: 1 };
  const result = applyTemplate({ obj: nested, num: 42 }, "x");
  assert.deepEqual(result.obj, nested);
  assert.equal(result.num, 42);
});

test("applyTemplate returns unchanged payload when prevOutput is empty", () => {
  const result = applyTemplate({ prompt: "hello {{prevOutput}}" }, "");
  assert.equal(result.prompt, "hello ");
});
