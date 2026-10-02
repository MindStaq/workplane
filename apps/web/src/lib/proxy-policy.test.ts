import { describe, expect, it } from "vitest";
import { isProxyAllowed } from "./proxy-policy";

describe("isProxyAllowed", () => {
  it("allows the operator-facing routes the UI uses", () => {
    expect(isProxyAllowed("GET", ["tasks"])).toBe(true);
    expect(isProxyAllowed("POST", ["tasks", "task_1", "retry"])).toBe(true);
    expect(isProxyAllowed("GET", ["runs", "run_1", "logs"])).toBe(true);
    expect(isProxyAllowed("POST", ["runs", "run_1", "input"])).toBe(true);
    expect(isProxyAllowed("PATCH", ["schedules", "sched_1"])).toBe(true);
    expect(isProxyAllowed("GET", ["nodes"])).toBe(true);
  });

  it("refuses node-only routes", () => {
    expect(isProxyAllowed("POST", ["nodes", "register"])).toBe(false);
    expect(isProxyAllowed("POST", ["nodes", "node_1", "poll"])).toBe(false);
    expect(isProxyAllowed("POST", ["runs", "run_1", "status"])).toBe(false);
    expect(isProxyAllowed("POST", ["runs", "run_1", "logs"])).toBe(false);
    expect(isProxyAllowed("GET", ["runs", "run_1", "input"])).toBe(false);
    expect(isProxyAllowed("POST", ["runs", "run_1", "input", "1", "delivered"])).toBe(false);
  });

  it("refuses unknown routes, wrong methods and path tricks", () => {
    expect(isProxyAllowed("GET", [])).toBe(false);
    expect(isProxyAllowed("DELETE", ["tasks", "task_1"])).toBe(false);
    expect(isProxyAllowed("GET", ["admin"])).toBe(false);
    expect(isProxyAllowed("GET", ["tasks", ".."])).toBe(false);
    expect(isProxyAllowed("GET", ["tasks", "a/b"])).toBe(false);
  });
});
