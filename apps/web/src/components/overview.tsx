import type { NodeRecord, RunLogRecord, RunRecord, TaskRecord, WorkplanRunRecord, WorkplanScheduleRecord } from "@workplane/types";
import { Capability, cn, Mono, Panel, Section, StatusBadge, StatusDot } from "@workplane/ui";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { isQueuedTask, successRate, taskSummary } from "../lib/derive";
import { describeCron } from "../lib/format";
import { KindIcon } from "./kind";
import { Elapsed, RelativeTime } from "./relative-time";

export function StatGrid({ runs, tasks, nodes }: { runs: RunRecord[]; tasks: TaskRecord[]; nodes: NodeRecord[] }) {
  const active = runs.filter((run) => run.status === "running").length;
  const queued = tasks.filter((task) => isQueuedTask(task.status)).length;
  const online = nodes.filter((node) => node.status === "online").length;
  const rate = successRate(runs);

  const stats = [
    { label: "Running", value: active, hint: "live runs", tone: "text-info" },
    { label: "Queue", value: queued, hint: "queued + assigned", tone: "text-warning" },
    { label: "Nodes online", value: `${online}/${nodes.length}`, hint: "of registered nodes", tone: "text-success" },
    {
      label: "Success rate",
      value: rate.percent === null ? "—" : `${rate.percent}%`,
      hint: rate.finished === 0 ? "no finished runs yet" : `${rate.failed} failed of ${rate.finished} finished`,
      tone: "text-foreground",
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-1 bg-card p-4">
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          <dd className={cn("font-mono text-2xl font-semibold tabular-nums", stat.tone)}>{stat.value}</dd>
          <dd className="text-xs text-muted-foreground">{stat.hint}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LiveRuns({
  runs,
  tasks,
  nodes,
  tails,
}: {
  runs: RunRecord[];
  tasks: Map<string, TaskRecord>;
  nodes: Map<string, NodeRecord>;
  tails: Map<string, RunLogRecord[]>;
}) {
  const live = runs.filter((run) => run.status === "running");
  return (
    <Section
      title="Live runs"
      action={
        <Link href="/runs" className="text-xs text-muted-foreground hover:text-foreground">
          All runs
        </Link>
      }
    >
      {live.length === 0 ? (
        <Panel className="p-8 text-center text-sm text-muted-foreground">Nothing is running right now.</Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {live.map((run) => {
            const task = tasks.get(run.taskId);
            const node = nodes.get(run.nodeId);
            const logs = tails.get(run.id) ?? [];
            return (
              <Link
                key={run.id}
                href={`/runs/${run.id}`}
                className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <KindIcon kind={task?.kind ?? ""} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{task ? taskSummary(task) : run.taskId}</span>
                  {task?.payload.interactive === true && (
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
                    on <Mono className="text-foreground">{node?.name ?? run.nodeId}</Mono>
                  </span>
                  <span>
                    {task?.adapter} · <span className="font-mono tabular-nums"><Elapsed start={run.startedAt} end={null} /></span>
                  </span>
                </div>
                {logs.length > 0 && (
                  <pre className="overflow-hidden bg-background/60 px-4 py-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                    {logs.map((log) => (
                      <div key={log.id} className={cn("truncate", log.stream === "system" && "text-info/80")}>
                        {log.message}
                      </div>
                    ))}
                  </pre>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </Section>
  );
}

export function QueuePanel({ tasks }: { tasks: TaskRecord[] }) {
  const pending = tasks.filter((task) => isQueuedTask(task.status));
  return (
    <Section title="Queue">
      <Panel>
        {pending.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">The queue is empty.</p>
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((task) => (
              <li key={task.id}>
                <Link href={`/tasks/${task.id}`} className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/40">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={task.status} className="h-5" />
                    <span className="ml-auto text-xs text-muted-foreground">
                      <RelativeTime iso={task.createdAt} />
                    </span>
                  </div>
                  <span className="truncate font-mono text-xs">{taskSummary(task)}</span>
                  <div className="flex flex-wrap gap-1">
                    {task.requires.map((requirement) => (
                      <Capability key={requirement} name={requirement} />
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Section>
  );
}

export function FleetPanel({ nodes, runs }: { nodes: NodeRecord[]; runs: RunRecord[] }) {
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
        {nodes.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">No nodes have registered. Run workplane-node on a machine to add one.</p>
        ) : (
          <ul className="divide-y divide-border">
            {nodes.map((node) => {
              const busy = runs.filter((run) => run.nodeId === node.id && run.status === "running").length;
              return (
                <li key={node.id} className="flex items-center gap-3 px-4 py-3">
                  <StatusDot status={node.status} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-mono text-sm">{node.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{node.capabilities.join(", ") || "no capabilities"}</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 text-xs">
                    <span className={busy ? "text-info" : "text-muted-foreground"}>
                      {busy ? `${busy} running` : node.status === "online" ? "idle" : "offline"}
                    </span>
                    <span className="text-muted-foreground">
                      <RelativeTime iso={node.lastHeartbeatAt} />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </Section>
  );
}

export function UpcomingSchedules({ schedules }: { schedules: WorkplanScheduleRecord[] }) {
  const upcoming = schedules.filter((schedule) => schedule.enabled && schedule.nextRunAt);
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
        {upcoming.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">No enabled schedules.</p>
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((schedule) => (
              <li key={schedule.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{schedule.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {describeCron(schedule.cronExpression)} · <Mono>{schedule.planId}</Mono>
                  </span>
                </div>
                <span className="text-xs text-foreground tabular-nums">
                  <RelativeTime iso={schedule.nextRunAt} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Section>
  );
}

export function RecentWorkplans({ runs }: { runs: WorkplanRunRecord[] }) {
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
        {runs.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">No workplan runs yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {runs.slice(0, 4).map((run) => (
              <li key={run.id}>
                <Link href={`/workplans/${run.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                  <StatusBadge status={run.status} className="h-5" />
                  <span className="min-w-0 flex-1 truncate text-sm">{run.planName}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {run.scheduleId ? "scheduled" : "manual"}
                  </span>
                  <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
                    <RelativeTime iso={run.createdAt} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Section>
  );
}
