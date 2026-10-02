import { NOW } from "./mock-data"
import type { TaskRecord } from "./types"

export function relativeTime(iso: string | null): string {
  if (!iso) return "—"
  const diff = new Date(iso).getTime() - NOW
  const abs = Math.abs(diff)
  const future = diff > 0
  const fmt = (v: number, unit: string) => (future ? `in ${v}${unit}` : `${v}${unit} ago`)
  if (abs < 60_000) return future ? "in <1m" : "just now"
  if (abs < 3_600_000) return fmt(Math.round(abs / 60_000), "m")
  if (abs < 86_400_000) return fmt(Math.round(abs / 3_600_000), "h")
  return fmt(Math.round(abs / 86_400_000), "d")
}

export function duration(startIso: string | null, endIso: string | null): string {
  if (!startIso) return "—"
  const end = endIso ? new Date(endIso).getTime() : NOW
  return formatMs(end - new Date(startIso).getTime())
}

export function formatMs(ms: number | null): string {
  if (ms == null) return "—"
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const rem = Math.round(s % 60)
  if (m < 60) return `${m}m ${rem}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export function clockTime(iso: string): string {
  return new Date(iso).toISOString().slice(11, 19)
}

export function taskSummary(task: TaskRecord): string {
  const p = task.payload
  if (typeof p.command === "string") return p.command
  if (typeof p.prompt === "string") return p.prompt
  return task.kind
}

export function describeCron(expr: string): string {
  const known: Record<string, string> = {
    "0 2 * * *": "Every day at 02:00",
    "0 9 * * 1": "Mondays at 09:00",
    "*/15 * * * *": "Every 15 minutes",
    "0 * * * *": "Every hour",
  }
  return known[expr] ?? "Custom schedule"
}
