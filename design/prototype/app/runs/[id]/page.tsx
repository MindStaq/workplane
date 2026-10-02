import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Ban, FileCode2, FileDiff, FileText, ScrollText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { KeyValue, KindLabel, Mono, PageHeader, Panel, Section } from "@/components/workplane/primitives"
import { RunConsole } from "@/components/workplane/run-console"
import { StatusBadge } from "@/components/workplane/status-badge"
import {
  getArtifactsForRun,
  getInputEventsForRun,
  getLogsForRun,
  getNode,
  getRun,
  getRunsForTask,
  getTask,
} from "@/lib/mock-data"
import { duration, relativeTime, taskSummary } from "@/lib/format"

const artifactIcons = { diff: FileDiff, transcript: ScrollText, log: FileCode2, text: FileText }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  return { title: id }
}

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const run = getRun(id)
  if (!run) notFound()
  const task = getTask(run.taskId)!
  const node = getNode(run.nodeId)
  const logs = getLogsForRun(run.id)
  const artifacts = getArtifactsForRun(run.id)
  const siblings = getRunsForTask(task.id)
  const live = run.status === "running" || run.status === "assigned"
  const interactive = task.payload.interactive === true

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
        actions={
          live && (
            <Button variant="outline" size="sm">
              <Ban data-icon="inline-start" />
              Cancel run
            </Button>
          )
        }
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
            <span className="flex flex-col">
              <Mono>{node?.name}</Mono>
              <span className="font-mono text-[11px] text-muted-foreground">
                {node?.host} · {node?.network}
              </span>
            </span>
          </KeyValue>
          <KeyValue label="Started">{relativeTime(run.startedAt)}</KeyValue>
          <KeyValue label="Duration">
            <span className="font-mono tabular-nums">{duration(run.startedAt, run.endedAt)}</span>
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
          <RunConsole
            runId={run.id}
            initialLogs={logs}
            initialEvents={getInputEventsForRun(run.id)}
            interactive={interactive}
            live={live}
          />
        </Section>

        <div className="flex flex-col gap-8">
          <Section title="Artifacts">
            <Panel>
              {artifacts.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground">No artifacts recorded.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {artifacts.map((a) => {
                    const Icon = artifactIcons[a.type as keyof typeof artifactIcons] ?? FileText
                    const meta = a.metadata ?? {}
                    return (
                      <li key={a.id} className="flex items-start gap-2.5 p-3">
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-mono text-xs">{a.name}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {a.type}
                            {typeof meta.additions === "number" && (
                              <>
                                {" · "}
                                <span className="text-success">+{meta.additions as number}</span>{" "}
                                <span className="text-destructive">-{meta.deletions as number}</span>
                              </>
                            )}
                            {meta.live === true && " · recording"}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
          </Section>

          {siblings.length > 1 && (
            <Section title="Attempts">
              <Panel>
                <ul className="divide-y divide-border">
                  {siblings.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/runs/${s.id}`}
                        aria-current={s.id === run.id ? "page" : undefined}
                        className="flex items-center gap-2 p-3 hover:bg-muted/40 aria-[current=page]:bg-muted/60"
                      >
                        <span className="font-mono text-xs text-muted-foreground">#{s.attempt}</span>
                        <Mono className="flex-1">{getNode(s.nodeId)?.name}</Mono>
                        <StatusBadge status={s.status} className="h-5" />
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
  )
}
