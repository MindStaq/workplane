import { Capability, KeyValue, Mono, PageHeader, Panel, Section, StatusBadge } from "@workplane/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { KindLabel } from "../../../src/components/kind";
import { RelativeTime } from "../../../src/components/relative-time";
import { RunsTable } from "../../../src/components/tables";
import { TaskActions } from "../../../src/components/task-actions";
import { loadTask } from "../../../src/lib/data";
import { byId, eligibleNodes, taskSummary } from "../../../src/lib/derive";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: id };
}

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { task, runs, nodes } = await loadTask(id);
  const nodeById = byId(nodes);
  const eligible = eligibleNodes(nodes, task.requires);
  const active = task.status === "queued" || task.status === "assigned" || task.status === "running";
  // The control plane only re-queues failed tasks; a cancelled task has to be submitted again.
  const retryable = task.status === "failed";

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/tasks" className="hover:text-foreground">
              Tasks
            </Link>
            <span aria-hidden="true">/</span>
            <Mono>{task.id}</Mono>
          </span>
        }
        title={<span className="font-mono text-xl">{taskSummary(task)}</span>}
        actions={<TaskActions taskId={task.id} canCancel={active} canRetry={retryable} />}
      />

      <Panel className="p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
          <KeyValue label="Status">
            <StatusBadge status={task.status} />
          </KeyValue>
          <KeyValue label="Kind">
            <KindLabel kind={task.kind} adapter={task.adapter} />
          </KeyValue>
          <KeyValue label="Created">
            <RelativeTime iso={task.createdAt} />
          </KeyValue>
          <KeyValue label="Attempts">
            <span className="font-mono">{runs.length}</span>
          </KeyValue>
          <div className="col-span-2 md:col-span-4">
            <KeyValue label="Requires">
              <div className="flex flex-wrap items-center gap-1.5">
                {task.requires.map((requirement) => (
                  <Capability key={requirement} name={requirement} matched />
                ))}
                <span className="text-xs text-muted-foreground">
                  {"→ "}
                  {eligible.length ? eligible.map((node) => node.name).join(", ") : "no eligible nodes"}
                </span>
              </div>
            </KeyValue>
          </div>
        </dl>
      </Panel>

      <div className="grid gap-8 lg:grid-cols-5">
        <Section title="Runs" className="lg:col-span-3">
          {runs.length ? (
            <RunsTable rows={runs.map((run) => ({ run, task, node: nodeById.get(run.nodeId) }))} showTask={false} />
          ) : (
            <Panel className="p-8 text-center text-sm text-muted-foreground">Waiting for an eligible node to claim this task.</Panel>
          )}
        </Section>
        <Section title="Payload" className="lg:col-span-2">
          <Panel>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-foreground/90">
              {JSON.stringify(task.payload, null, 2)}
            </pre>
          </Panel>
        </Section>
      </div>
    </>
  );
}
