import type { NodeRecord, RunRecord } from "@workplane/types";
import { describe, expect, it } from "vitest";
import { eligibleNodes, kindGroup, latestRunByTask, stepState, successRate, taskSummary } from "./derive";

function run(overrides: Partial<RunRecord>): RunRecord {
  return { id: "run_1", taskId: "task_1", nodeId: "node_1", attempt: 1, status: "succeeded", startedAt: null, endedAt: null, error: null, ...overrides };
}

describe("kindGroup and taskSummary", () => {
  it("maps control-plane kinds onto the prototype's three families", () => {
    expect(kindGroup({ kind: "shell.exec" })).toBe("shell");
    expect(kindGroup({ kind: "inference.batch" })).toBe("inference");
    expect(kindGroup({ kind: "agent.run" })).toBe("harness");
    expect(kindGroup({ kind: "something.new" })).toBe("other");
  });

  it("summarises by command, then prompt, then kind", () => {
    expect(taskSummary({ kind: "shell.exec", payload: { command: "npm test" } })).toBe("npm test");
    expect(taskSummary({ kind: "agent.run", payload: { prompt: "Fix it" } })).toBe("Fix it");
    expect(taskSummary({ kind: "agent.run", payload: {} })).toBe("agent.run");
  });
});

describe("eligibleNodes", () => {
  const nodes: Pick<NodeRecord, "id" | "capabilities">[] = [
    { id: "a", capabilities: ["shell", "git"] },
    { id: "b", capabilities: ["shell"] },
  ];

  it("requires every capability", () => {
    expect(eligibleNodes(nodes, ["shell", "git"]).map((n) => n.id)).toEqual(["a"]);
    expect(eligibleNodes(nodes, ["gpu"])).toEqual([]);
    expect(eligibleNodes(nodes, [])).toHaveLength(2);
  });
});

describe("latestRunByTask and successRate", () => {
  it("keeps the highest attempt per task", () => {
    const latest = latestRunByTask([run({ id: "r1", attempt: 1 }), run({ id: "r2", attempt: 2 }), run({ id: "r3", taskId: "task_2" })]);
    expect(latest.get("task_1")?.id).toBe("r2");
    expect(latest.get("task_2")?.id).toBe("r3");
  });

  it("only counts finished runs and tolerates an empty fleet", () => {
    expect(successRate([])).toEqual({ finished: 0, failed: 0, percent: null });
    const rate = successRate([
      run({ endedAt: "2026-01-01T00:00:00Z" }),
      run({ endedAt: "2026-01-01T00:00:00Z", status: "failed" }),
      run({ status: "running" }),
    ]);
    expect(rate).toEqual({ finished: 2, failed: 1, percent: 50 });
  });
});

describe("stepState", () => {
  it("derives a step's state from its recorded result and the run status", () => {
    const result = { exitCode: 0 } as Parameters<typeof stepState>[0];
    expect(stepState(result, "completed", false)).toBe("ok");
    expect(stepState({ exitCode: 1 } as Parameters<typeof stepState>[0], "step_failed", false)).toBe("fail");
    expect(stepState(undefined, "running", true)).toBe("running");
    expect(stepState(undefined, "failed", true)).toBe("pending");
  });
});
