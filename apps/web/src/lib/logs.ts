import type { RunLogRecord } from "@workplane/types";

/** Appends newly fetched log rows, ignoring any id already present, and keeps them ordered by id. */
export function mergeLogs(existing: RunLogRecord[], incoming: RunLogRecord[]): RunLogRecord[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((log) => log.id));
  const fresh = incoming.filter((log) => !seen.has(log.id));
  return fresh.length === 0 ? existing : [...existing, ...fresh].sort((a, b) => a.id - b.id);
}

export function lastLogId(logs: RunLogRecord[]): number {
  return logs.reduce((max, log) => Math.max(max, log.id), 0);
}
