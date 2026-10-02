import type { RunLogRecord } from "@workplane/types";
import { describe, expect, it } from "vitest";
import { lastLogId, mergeLogs } from "./logs";

function log(id: number): RunLogRecord {
  return { id, runId: "run_1", stepName: null, stream: "stdout", message: `line ${id}`, timestamp: "2026-10-02T14:32:00Z" };
}

describe("mergeLogs", () => {
  it("appends only rows it has not seen", () => {
    const merged = mergeLogs([log(1), log(2)], [log(2), log(3)]);
    expect(merged.map((l) => l.id)).toEqual([1, 2, 3]);
  });

  it("returns the same array when nothing is new, so React skips the render", () => {
    const existing = [log(1)];
    expect(mergeLogs(existing, [log(1)])).toBe(existing);
    expect(mergeLogs(existing, [])).toBe(existing);
  });

  it("finds the cursor for the next incremental fetch", () => {
    expect(lastLogId([])).toBe(0);
    expect(lastLogId([log(4), log(9), log(7)])).toBe(9);
  });
});
