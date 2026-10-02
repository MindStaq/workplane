import { KeyValue, Mono, PageHeader, Panel, Section, StatusBadge } from "@workplane/ui";
import { FileCode2, FileDiff, FileText, ScrollText, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { KindLabel } from "../../../src/components/kind";
import { Elapsed, RelativeTime } from "../../../src/components/relative-time";
import { RunConsole } from "../../../src/components/run-console";
import { TaskActions } from "../../../src/components/task-actions";
import { loadRun } from "../../../src/lib/data";
import { taskSummary } from "../../../src/lib/derive";

const artifactIcons: Record<string, LucideIcon> = { diff: FileDiff, transcript: ScrollText, log: FileCode2, text: FileText };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: id };
}

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { run, task, node, nodes, logs, artifacts, eventCount, siblings } = await loadRun(id);
  const live = run.status === "running" || run.status === "assigned";
  const interactive = task.payload.interactive === true;

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/runs" className="hover:text-foreground">
              Runs
            </Link>
            <span aria-hidden="true">/</span>
            <Mono>{run.id}</Mono>
          </span>
        }
        title={<span className="font-mono text-xl">{taskSummary(task)}</span>}
        description={
          <>
            Attempt {run.attempt} of task{" "}
            <Link href={`/tasks/${task.id}`} className="font-mono text-foreground underline-offset-4 hover:underline">
              {task.id}
            </Link>
          </>
        }
        actions={live && <TaskActions taskId={task.id} canCancel canRetry={false} cancelLabel="Cancel run" />}
      />

      <Panel className="p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-5">
          <KeyValue label="Status">
            <StatusBadge status={run.status} />
          </KeyValue>
          <KeyValue label="Adapter">
            <KindLabel kind={task.kind} adapter={task.adapter} />
          </KeyValue>
          <KeyValue label="Node">
            <Mono>{node?.name ?? run.nodeId}</Mono>
          </KeyValue>
          <KeyValue label="Started">
            <RelativeTime iso={run.startedAt} />
          </KeyValue>
          <KeyValue label="Duration">
            <span className="font-mono tabular-nums">
              <Elapsed start={run.startedAt} end={run.endedAt} />
            </span>
          </KeyValue>
        </dl>
        {run.error && (
          <div className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
            {run.error}
          </div>
        )}
      </Panel>

      <div className="grid gap-8 lg:grid-cols-4">
        <Section title={interactive ? "Session" : "Logs"} className="lg:col-span-3">
          <RunConsole runId={run.id} initialLogs={logs} eventCount={eventCount} interactive={interactive} live={live} />
        </Section>

        <div className="flex flex-col gap-8">
          <Section title="Artifacts">
            <Panel>
              {artifacts.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground">No artifacts recorded.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {artifacts.map((artifact) => {
                    const Icon = artifactIcons[artifact.type] ?? FileText;
                    const meta = artifact.metadata ?? {};
                    return (
                      <li key={artifact.id} className="flex items-start gap-2.5 p-3">
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-mono text-xs" title={artifact.path}>
                            {artifact.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {artifact.type}
                            {typeof meta.additions === "number" && (
                              <>
                                {" · "}
                                <span className="text-success">+{meta.additions}</span>{" "}
                                <span className="text-destructive">-{String(meta.deletions ?? 0)}</span>
                              </>
                            )}
                            {meta.live === true && " · recording"}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </Section>

          {siblings.length > 1 && (
            <Section title="Attempts">
              <Panel>
                <ul className="divide-y divide-border">
                  {siblings.map((sibling) => (
                    <li key={sibling.id}>
                      <Link
                        href={`/runs/${sibling.id}`}
                        aria-current={sibling.id === run.id ? "page" : undefined}
                        className="flex items-center gap-2 p-3 hover:bg-muted/40 aria-[current=page]:bg-muted/60"
                      >
                        <span className="font-mono text-xs text-muted-foreground">#{sibling.attempt}</span>
                        <Mono className="flex-1">{nodes.get(sibling.nodeId)?.name ?? sibling.nodeId}</Mono>
                        <StatusBadge status={sibling.status} className="h-5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
