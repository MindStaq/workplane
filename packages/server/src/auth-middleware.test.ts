import assert from "node:assert/strict";
import { test } from "node:test";
import { routeAuthFor } from "./auth-middleware.js";

test("routeAuthFor marks node poll as node auth", () => {
  assert.equal(routeAuthFor("POST", "/nodes/node_abc/poll"), "node");
});

test("routeAuthFor marks task create as operator auth", () => {
  assert.equal(routeAuthFor("POST", "/tasks"), "operator");
});

test("routeAuthFor marks healthz as public", () => {
  assert.equal(routeAuthFor("GET", "/healthz"), "public");
});
