import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Ban, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Capability, KeyValue, KindLabel, Mono, PageHeader, Panel, Section } from "@/components/workplane/primitives"
import { StatusBadge } from "@/components/workplane/status-badge"
import { RunsTable } from "@/components/workplane/tables"
import { getRunsForTask, getTask, nodes } from "@/lib/mock-data"
import { relativeTime, taskSummary } from "@/lib/format"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  return { title: id }
}

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const task = getTask(id)
  if (!task) notFound()

  const taskRuns = getRunsForTask(task.id)
  const eligible = nodes.filter((n) => task.requires.every((r) => n.capabilities.includes(r)))
  const active = task.status === "queued" || task.status === "assigned" || task.status === "running"
  const retryable = task.status === "failed" || task.status === "cancelled"

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
        actions={
          <>
            {active && (
              <Button variant="outline" size="sm">
                <Ban data-icon="inline-start" />
                Cancel
              </Button>
            )}
            {retryable && (
              <Button size="sm">
                <RotateCcw data-icon="inline-start" />
                Retry
              </Button>
            )}
          </>
        }
      />

      <Panel className="p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
          <KeyValue label="Status">
            <StatusBadge status={task.status} />
          </KeyValue>
          <KeyValue label="Kind">
            <KindLabel kind={task.kind} adapter={task.adapter} />
          </KeyValue>
          <KeyValue label="Created">{relativeTime(task.createdAt)}</KeyValue>
          <KeyValue label="Attempts">
            <span className="font-mono">{taskRuns.length}</span>
          </KeyValue>
          <div className="col-span-2 md:col-span-4">
            <KeyValue label="Requires">
              <div className="flex flex-wrap items-center gap-1.5">
                {task.requires.map((r) => (
                  <Capability key={r} name={r} matched />
                ))}
                <span className="text-xs text-muted-foreground">
                  {"→ "}
                  {eligible.length ? eligible.map((n) => n.name).join(", ") : "no eligible nodes"}
                </span>
              </div>
            </KeyValue>
          </div>
        </dl>
      </Panel>

      <div className="grid gap-8 lg:grid-cols-5">
        <Section title="Runs" className="lg:col-span-3">
          {taskRuns.length ? (
            <RunsTable runs={taskRuns} showTask={false} />
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
  )
}
