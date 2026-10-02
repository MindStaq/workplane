import type { Metadata } from "next"
import Link from "next/link"
import { Network } from "lucide-react"
import { Capability, Mono, PageHeader, Panel } from "@/components/workplane/primitives"
import { StatusBadge } from "@/components/workplane/status-badge"
import { getRunsForNode, getTask, nodes } from "@/lib/mock-data"
import { relativeTime, taskSummary } from "@/lib/format"

export const metadata: Metadata = { title: "Nodes" }

export default function NodesPage() {
  return (
    <>
      <PageHeader
        title="Nodes"
        description="Machines that poll the control plane and execute tasks whose required capabilities they advertise."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {nodes.map((n) => {
          const nodeRuns = getRunsForNode(n.id)
          const current = nodeRuns.find((r) => r.status === "running" || r.status === "assigned")
          const currentTask = current ? getTask(current.taskId) : undefined
          const done = nodeRuns.filter((r) => r.endedAt)
          const ok = done.filter((r) => r.status === "succeeded").length
          return (
            <Panel key={n.id} className="flex flex-col">
              <div className="flex items-start gap-3 p-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-mono text-base font-semibold">{n.name}</h2>
                    <Mono className="text-muted-foreground">{n.id}</Mono>
                  </div>
                  <p className="text-sm text-muted-foreground">{n.role}</p>
                </div>
                <StatusBadge status={n.status} />
              </div>

              <dl className="grid grid-cols-3 gap-px border-y border-border bg-border text-xs">
                <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                  <dt className="text-muted-foreground">Heartbeat</dt>
                  <dd className="font-mono tabular-nums">{relativeTime(n.lastHeartbeatAt)}</dd>
                </div>
                <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                  <dt className="text-muted-foreground">Runs</dt>
                  <dd className="font-mono tabular-nums">
                    {ok}/{done.length} ok
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <Network className="size-3" aria-hidden="true" />
                    {n.network}
                  </dt>
                  <dd className="truncate font-mono">{n.host}</dd>
                </div>
              </dl>

              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex flex-wrap gap-1">
                  {n.capabilities.map((c) => (
                    <Capability key={c} name={c} />
                  ))}
                </div>
                {n.models && (
                  <p className="text-xs text-muted-foreground">
                    Models: <span className="font-mono text-foreground/80">{n.models.join(", ")}</span>
                  </p>
                )}
                <p className="font-mono text-[11px] text-muted-foreground">{n.platform}</p>
              </div>

              <div className="border-t border-border px-4 py-3 text-xs">
                {currentTask && current ? (
                  <Link href={`/runs/${current.id}`} className="flex items-center gap-2 hover:text-primary">
                    <StatusBadge status={current.status} className="h-5" />
                    <span className="truncate font-mono">{taskSummary(currentTask)}</span>
                  </Link>
                ) : (
                  <span className="text-muted-foreground">
                    {n.status === "online" ? "Idle — polling for work" : "Not polling. Run workplane-node on this host to reconnect."}
                  </span>
                )}
              </div>
            </Panel>
          )
        })}
      </div>
    </>
  )
}
