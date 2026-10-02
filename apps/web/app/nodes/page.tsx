import { Capability, Mono, PageHeader, Panel, StatusBadge } from "@workplane/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { RelativeTime } from "../../src/components/relative-time";
import { loadNodes } from "../../src/lib/data";
import { taskSummary } from "../../src/lib/derive";

export const metadata: Metadata = { title: "Nodes" };

export default async function NodesPage() {
  const { nodes, runs, tasks } = await loadNodes();
  return (
    <>
      <PageHeader
        title="Nodes"
        description="Machines that poll the control plane and execute tasks whose required capabilities they advertise."
      />
      {nodes.length === 0 && (
        <Panel className="p-8 text-center text-sm text-muted-foreground">
          No nodes have registered yet. Run <Mono>workplane-node</Mono> on a machine to add one.
        </Panel>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {nodes.map((node) => {
          const nodeRuns = runs.filter((run) => run.nodeId === node.id);
          const current = nodeRuns.find((run) => run.status === "running" || run.status === "assigned");
          const currentTask = current ? tasks.get(current.taskId) : undefined;
          const done = nodeRuns.filter((run) => run.endedAt);
          const ok = done.filter((run) => run.status === "succeeded").length;
          return (
            <Panel key={node.id} className="flex flex-col">
              <div className="flex items-start gap-3 p-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-mono text-base font-semibold">{node.name}</h2>
                    <Mono className="text-muted-foreground">{node.id}</Mono>
                  </div>
                </div>
                <StatusBadge status={node.status} />
              </div>

              <dl className="grid grid-cols-3 gap-px border-y border-border bg-border text-xs">
                <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                  <dt className="text-muted-foreground">Heartbeat</dt>
                  <dd className="font-mono tabular-nums">
                    <RelativeTime iso={node.lastHeartbeatAt} />
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                  <dt className="text-muted-foreground">Runs</dt>
                  <dd className="font-mono tabular-nums">
                    {ok}/{done.length} ok
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                  <dt className="text-muted-foreground">Capabilities</dt>
                  <dd className="font-mono tabular-nums">{node.capabilities.length}</dd>
                </div>
              </dl>

              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex flex-wrap gap-1">
                  {node.capabilities.map((capability) => (
                    <Capability key={capability} name={capability} />
                  ))}
                </div>
              </div>

              <div className="border-t border-border px-4 py-3 text-xs">
                {currentTask && current ? (
                  <Link href={`/runs/${current.id}`} className="flex items-center gap-2 hover:text-primary">
                    <StatusBadge status={current.status} className="h-5" />
                    <span className="truncate font-mono">{taskSummary(currentTask)}</span>
                  </Link>
                ) : (
                  <span className="text-muted-foreground">
                    {node.status === "online" ? "Idle — polling for work" : "Not polling. Run workplane-node on this host to reconnect."}
                  </span>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
