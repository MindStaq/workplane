import assert from "node:assert/strict";
import { test } from "node:test";
import { backoffDelay, httpStatusOf, isNodeUnknownError, registerWithRetry } from "./registration.js";

test("backoffDelay doubles from the initial delay and caps at the maximum", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7].map((attempt) => backoffDelay(attempt, 1000, 30_000)),
    [1000, 2000, 4000, 8000, 16_000, 30_000, 30_000],
  );
});

test("httpStatusOf reads the status workplaneFetch puts at the start of its error message", () => {
  assert.equal(httpStatusOf(new Error("404 Not Found from /nodes/x/poll: {}")), 404);
  assert.equal(httpStatusOf(new Error("fetch failed")), undefined);
});

test("isNodeUnknownError is true for 401 and 404 only", () => {
  assert.equal(isNodeUnknownError(new Error("404 Not Found from /nodes/x/poll")), true);
  assert.equal(isNodeUnknownError(new Error("401 Unauthorized from /nodes/x/poll")), true);
  assert.equal(isNodeUnknownError(new Error("500 Internal Server Error from /nodes/x/poll")), false);
  assert.equal(isNodeUnknownError(new TypeError("fetch failed")), false);
});

test("registerWithRetry keeps retrying with backoff until the server answers", async () => {
  let calls = 0;
  const sleeps: number[] = [];
  const nodeId = await registerWithRetry(
    async () => {
      calls += 1;
      if (calls < 4) {
        throw new TypeError("fetch failed");
      }
      return "node_123";
    },
    { initialDelayMs: 10, maxDelayMs: 25, sleep: async (ms) => void sleeps.push(ms), log: () => {} },
  );
  assert.equal(nodeId, "node_123");
  assert.equal(calls, 4);
  assert.deepEqual(sleeps, [10, 20, 25]);
});
