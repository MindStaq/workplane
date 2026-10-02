import assert from "node:assert/strict";
import { test } from "node:test";
import { isAuthorizedBearer, parseBearerToken } from "./auth.js";

test("parseBearerToken extracts token", () => {
  assert.equal(parseBearerToken("Bearer abc123"), "abc123");
});

test("isAuthorizedBearer allows when expected token unset", () => {
  assert.equal(isAuthorizedBearer(undefined, undefined), true);
});

test("isAuthorizedBearer rejects mismatch", () => {
  assert.equal(isAuthorizedBearer("wrong", "expected"), false);
  assert.equal(isAuthorizedBearer("expected", "expected"), true);
});
