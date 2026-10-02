import assert from "node:assert/strict";
import { test } from "node:test";
import { checkRouteAuth, requiresConfiguredToken, routeAuthFor } from "./auth-middleware.js";

test("routeAuthFor marks node poll as node auth", () => {
  assert.equal(routeAuthFor("POST", "/nodes/node_abc/poll"), "node");
});

test("routeAuthFor marks task create as operator auth", () => {
  assert.equal(routeAuthFor("POST", "/tasks"), "operator");
});

test("routeAuthFor marks schedule create as operator auth", () => {
  assert.equal(routeAuthFor("POST", "/schedules"), "operator");
});

test("routeAuthFor marks schedule tick as operator auth", () => {
  assert.equal(routeAuthFor("POST", "/schedules/tick"), "operator");
});

test("reads stay public by default", () => {
  assert.equal(routeAuthFor("GET", "/tasks"), "public");
  assert.equal(routeAuthFor("GET", "/nodes"), "public");
});

test("protectReads requires a token on reads but never on /healthz", () => {
  assert.equal(routeAuthFor("GET", "/tasks", { protectReads: true }), "read");
  assert.equal(routeAuthFor("GET", "/runs/run_1/logs", { protectReads: true }), "read");
  assert.equal(routeAuthFor("GET", "/healthz", { protectReads: true }), "public");
  assert.equal(routeAuthFor("GET", "/runs/run_1/input", { protectReads: true }), "node");
  assert.equal(routeAuthFor("POST", "/tasks", { protectReads: true }), "operator");
});

test("a protected read accepts the operator or node token and rejects others", () => {
  const config = { operatorToken: "op", nodeToken: "nd" };
  assert.equal(requiresConfiguredToken("read", config), true);
  assert.equal(requiresConfiguredToken("read", {}), false);

  const run = (bearer: string | undefined): { ok: boolean; status: number } => {
    const res = { statusCode: 200, setHeader() {}, end() {} };
    const req = { headers: bearer ? { authorization: `Bearer ${bearer}` } : {} };
    const ok = checkRouteAuth(req as never, res as never, "read", config);
    return { ok, status: res.statusCode };
  };
  assert.deepEqual(run("op"), { ok: true, status: 200 });
  assert.deepEqual(run("nd"), { ok: true, status: 200 });
  assert.deepEqual(run("wrong"), { ok: false, status: 401 });
  assert.deepEqual(run(undefined), { ok: false, status: 401 });
});
