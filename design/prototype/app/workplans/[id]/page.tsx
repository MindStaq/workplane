import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Check, Circle, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { KeyValue, Mono, PageHeader, Panel, Section } from "@/components/workplane/primitives"
import { StatusBadge } from "@/components/workplane/status-badge"
import { getSchedule, getSkill, getStepsForWorkplanRun, getWorkplanRun } from "@/lib/mock-data"
import { duration, formatMs, relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  return { title: id }
}

export default async function WorkplanRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const wpr = getWorkplanRun(id)
  if (!wpr) notFound()
  const skill = getSkill(wpr.planId)
  const results = getStepsForWorkplanRun(wpr.id)
  const schedule = wpr.scheduleId ? getSchedule(wpr.scheduleId) : undefined
  const planned = skill?.steps ?? results.map((r) => ({ id: r.stepId, name: r.stepName, provider: String(r.metadata?.provider ?? "") }))

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/workplans" className="hover:text-foreground">
              Workplans
            </Link>
            <span aria-hidden="true">/</span>
            <Mono>{wpr.id}</Mono>
          </span>
        }
        title={wpr.planName}
        description={skill?.description}
        actions={
          (wpr.status === "step_failed" || wpr.status === "cancelled") && (
            <Button size="sm">
              <RotateCcw data-icon="inline-start" />
              Re-run plan
            </Button>
          )
        }
      />

      <Panel className="p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
          <KeyValue label="Status">
            <StatusBadge status={wpr.status} />
          </KeyValue>
          <KeyValue label="Trigger">
            {schedule ? (
              <Link href="/schedules" className="hover:text-primary">
                {schedule.name}
              </Link>
            ) : (
              "Manual"
            )}
          </KeyValue>
          <KeyValue label="Started">{relativeTime(wpr.createdAt)}</KeyValue>
          <KeyValue label="Duration">
            <span className="font-mono tabular-nums">{duration(wpr.createdAt, wpr.endedAt)}</span>
          </KeyValue>
          {wpr.idempotencyKey && (
            <div className="col-span-2 md:col-span-4">
              <KeyValue label="Idempotency key">
                <Mono className="text-muted-foreground">{wpr.idempotencyKey}</Mono>
              </KeyValue>
            </div>
          )}
        </dl>
        {wpr.error && (
          <div className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
            {wpr.error}
          </div>
        )}
      </Panel>

      <Section title="Steps">
        <ol className="flex flex-col">
          {planned.map((step, i) => {
            const result = results.find((r) => r.stepId === step.id)
            const running = !result && wpr.status === "running" && i === results.length
            const state = result ? (result.exitCode === 0 ? "ok" : "fail") : running ? "running" : "pending"
            const last = i === planned.length - 1
            return (
              <li key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
                {!last && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-border" aria-hidden="true" />}
                <span
                  className={cn(
                    "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border",
                    state === "ok" && "border-success/40 bg-success/10 text-success",
                    state === "fail" && "border-destructive/40 bg-destructive/10 text-destructive",
                    state === "running" && "border-info/40 bg-info/10 text-info",
                    state === "pending" && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {state === "ok" && <Check className="size-4" aria-hidden="true" />}
                  {state === "fail" && <X className="size-4" aria-hidden="true" />}
                  {state === "running" && <Circle className="size-3 animate-pulse fill-current" aria-hidden="true" />}
                  {state === "pending" && <span className="font-mono text-xs">{i + 1}</span>}
                  <span className="sr-only">{state}</span>
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-medium">{step.name}</span>
                    <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {step.provider}
                      {"model" in step && step.model ? ` · ${step.model}` : ""}
                    </span>
                    {result && (
                      <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
                        exit {result.exitCode} · {formatMs(result.durationMs)}
                      </span>
                    )}
                  </div>
                  {result ? (
                    <Panel>
                      <pre
                        className={cn(
                          "overflow-x-auto p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap",
                          result.exitCode === 0 ? "text-foreground/90" : "text-destructive",
                        )}
                      >
                        {result.output}
                      </pre>
                      {result.metadata && Object.keys(result.metadata).length > 0 && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-3 py-2 font-mono text-[11px] text-muted-foreground">
                          {Object.entries(result.metadata).map(([k, v]) => (
                            <span key={k}>
                              {k}=<span className="text-foreground/80">{String(v)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </Panel>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {running ? "Executing…" : wpr.status === "running" ? "Waiting for previous step" : "Not executed"}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </Section>
    </>
  )
}
