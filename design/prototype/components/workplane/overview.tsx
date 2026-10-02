import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import {
  getLogsForRun,
  getNode,
  getRunsForNode,
  getTask,
  nodes,
  runs,
  schedules,
  tasks,
  workplanRuns,
} from "@/lib/mock-data"
import { describeCron, duration, relativeTime, taskSummary } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Capability, KindIcon, Mono, Panel, Section } from "./primitives"
import { StatusBadge, StatusDot } from "./status-badge"

export function StatGrid() {
  const active = runs.filter((r) => r.status === "running").length
  const queued = tasks.filter((t) => t.status === "queued" || t.status === "assigned").length
  const online = nodes.filter((n) => n.status === "online").length
  const finished = runs.filter((r) => r.endedAt)
  const failed = finished.filter((r) => r.status === "failed").length
  const successRate = Math.round(((finished.length - failed) / finished.length) * 100)

  const stats = [
    { label: "Running", value: active, hint: "live runs", tone: "text-info" },
    { label: "Queue", value: queued, hint: "queued + assigned", tone: "text-warning" },
    { label: "Nodes online", value: `${online}/${nodes.length}`, hint: "heartbeat < 30s", tone: "text-success" },
    { label: "Success rate", value: `${successRate}%`, hint: `${failed} failed of ${finished.length} today`, tone: "text-foreground" },
  ]

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1 bg-card p-4">
          <dt className="text-xs text-muted-foreground">{s.label}</dt>
          <dd className={cn("font-mono text-2xl font-semibold tabular-nums", s.tone)}>{s.value}</dd>
          <dd className="text-xs text-muted-foreground">{s.hint}</dd>
        </div>
      ))}
    </dl>
  )
}

export function LiveRuns() {
  const live = runs.filter((r) => r.status === "running")
  return (
    <Section
      title="Live runs"
      action={
        <Link href="/runs" className="text-xs text-muted-foreground hover:text-foreground">
          All runs
        </Link>
      }
    >
      <div className="flex flex-col gap-3">
        {live.map((run) => {
          const task = getTask(run.taskId)!
          const node = getNode(run.nodeId)
          const logs = getLogsForRun(run.id).slice(-3)
          return (
            <Link
              key={run.id}
              href={`/runs/${run.id}`}
              className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <KindIcon kind={task.kind} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{taskSummary(task)}</span>
                {task.payload.interactive === true && (
                  <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-primary">
                    interactive
                  </span>
                )}
                <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <StatusBadge status={run.status} className="h-5" />
                <Mono>{run.id}</Mono>
                <span>
                  on <Mono className="text-foreground">{node?.name}</Mono>
                </span>
                <span>
                  {task.adapter} · <span className="font-mono tabular-nums">{duration(run.startedAt, null)}</span>
                </span>
              </div>
              <pre className="overflow-hidden bg-background/60 px-4 py-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {logs.map((l) => (
                  <div key={l.id} className={cn("truncate", l.stream === "system" && "text-info/80")}>
                    {l.message}
                  </div>
                ))}
              </pre>
            </Link>
          )
        })}
      </div>
    </Section>
  )
}

export function QueuePanel() {
  const pending = tasks.filter((t) => t.status === "queued" || t.status === "assigned")
  return (
    <Section title="Queue">
      <Panel>
        <ul className="divide-y divide-border">
          {pending.map((t) => (
            <li key={t.id}>
              <Link href={`/tasks/${t.id}`} className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/40">
                <div className="flex items-center gap-2">
                  <StatusBadge status={t.status} className="h-5" />
                  <span className="ml-auto text-xs text-muted-foreground">{relativeTime(t.createdAt)}</span>
                </div>
                <span className="truncate font-mono text-xs">{taskSummary(t)}</span>
                <div className="flex flex-wrap gap-1">
                  {t.requires.map((r) => (
                    <Capability key={r} name={r} />
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </Section>
  )
}

export function FleetPanel() {
  return (
    <Section
      title="Fleet"
      action={
        <Link href="/nodes" className="text-xs text-muted-foreground hover:text-foreground">
          Manage
        </Link>
      }
    >
      <Panel>
        <ul className="divide-y divide-border">
          {nodes.map((n) => {
            const busy = getRunsForNode(n.id).filter((r) => r.status === "running").length
            return (
              <li key={n.id} className="flex items-center gap-3 px-4 py-3">
                <StatusDot status={n.status} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-mono text-sm">{n.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{n.role}</span>
                </div>
                <div className="flex flex-col items-end gap-0.5 text-xs">
                  <span className={busy ? "text-info" : "text-muted-foreground"}>{busy ? `${busy} running` : n.status === "online" ? "idle" : "offline"}</span>
                  <span className="text-muted-foreground">{relativeTime(n.lastHeartbeatAt)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      </Panel>
    </Section>
  )
}

export function UpcomingSchedules() {
  const upcoming = schedules.filter((s) => s.enabled && s.nextRunAt)
  return (
    <Section
      title="Upcoming"
      action={
        <Link href="/schedules" className="text-xs text-muted-foreground hover:text-foreground">
          Schedules
        </Link>
      }
    >
      <Panel>
        <ul className="divide-y divide-border">
          {upcoming.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {describeCron(s.cronExpression)} · <Mono>{s.planId}</Mono>
                </span>
              </div>
              <span className="text-xs text-foreground tabular-nums">{relativeTime(s.nextRunAt)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </Section>
  )
}

export function RecentWorkplans() {
  return (
    <Section
      title="Recent workplan runs"
      action={
        <Link href="/workplans" className="text-xs text-muted-foreground hover:text-foreground">
          All workplans
        </Link>
      }
    >
      <Panel>
        <ul className="divide-y divide-border">
          {workplanRuns.slice(0, 4).map((w) => (
            <li key={w.id}>
              <Link href={`/workplans/${w.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                <StatusBadge status={w.status} className="h-5" />
                <span className="min-w-0 flex-1 truncate text-sm">{w.planName}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">{w.scheduleId ? "scheduled" : "manual"}</span>
                <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">{relativeTime(w.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </Section>
  )
}
