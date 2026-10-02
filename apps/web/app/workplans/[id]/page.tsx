import { Button, KeyValue, Mono, PageHeader, Panel, Section, StatusBadge, cn } from "@workplane/ui";
import { Check, Circle, RotateCcw, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Elapsed, RelativeTime } from "../../../src/components/relative-time";
import { loadWorkplanRun } from "../../../src/lib/data";
import { stepState } from "../../../src/lib/derive";
import { formatMs } from "../../../src/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: id };
}

export default async function WorkplanRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { run, steps, skill, schedule } = await loadWorkplanRun(id);
  const rerunnable = run.status === "step_failed" || run.status === "cancelled";

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/workplans" className="hover:text-foreground">
              Workplans
            </Link>
            <span aria-hidden="true">/</span>
            <Mono>{run.id}</Mono>
          </span>
        }
        title={run.planName}
        description={skill?.description}
        actions={
          rerunnable && (
            <Button size="sm" disabled title="Re-running a plan needs a control-plane endpoint that does not exist yet">
              <RotateCcw data-icon="inline-start" />
              Re-run plan
            </Button>
          )
        }
      />

      <Panel className="p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
          <KeyValue label="Status">
            <StatusBadge status={run.status} />
          </KeyValue>
          <KeyValue label="Trigger">
            {schedule ? (
              <Link href="/schedules" className="hover:text-primary">
                {schedule.name}
              </Link>
            ) : run.scheduleId ? (
              "Schedule removed"
            ) : (
              "Manual"
            )}
          </KeyValue>
          <KeyValue label="Started">
            <RelativeTime iso={run.createdAt} />
          </KeyValue>
          <KeyValue label="Duration">
            <span className="font-mono tabular-nums">
              <Elapsed start={run.createdAt} end={run.endedAt} />
            </span>
          </KeyValue>
          {run.idempotencyKey && (
            <div className="col-span-2 md:col-span-4">
              <KeyValue label="Idempotency key">
                <Mono className="text-muted-foreground">{run.idempotencyKey}</Mono>
              </KeyValue>
            </div>
          )}
        </dl>
        {run.error && (
          <div className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
            {run.error}
          </div>
        )}
      </Panel>

      <Section title="Steps">
        {steps.length === 0 ? (
          <Panel className="p-8 text-center text-sm text-muted-foreground">
            {run.status === "running" ? "Waiting for the first step to finish." : "No steps were recorded for this run."}
          </Panel>
        ) : (
          <ol className="flex flex-col">
            {steps.map((step, index) => {
              const state = stepState(step, run.status, false);
              const last = index === steps.length - 1 && run.status !== "running";
              const provider = typeof step.metadata?.provider === "string" ? step.metadata.provider : null;
              return (
                <li key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {!last && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-border" aria-hidden="true" />}
                  <span
                    className={cn(
                      "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border",
                      state === "ok" && "border-success/40 bg-success/10 text-success",
                      state === "fail" && "border-destructive/40 bg-destructive/10 text-destructive",
                    )}
                  >
                    {state === "ok" ? <Check className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
                    <span className="sr-only">{state}</span>
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-sm font-medium">{step.stepName}</span>
                      {provider && (
                        <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {provider}
                        </span>
                      )}
                      <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
                        exit {step.exitCode ?? "—"} · {formatMs(step.durationMs)}
                      </span>
                    </div>
                    <Panel>
                      <pre
                        className={cn(
                          "overflow-x-auto p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap",
                          step.exitCode === 0 ? "text-foreground/90" : "text-destructive",
                        )}
                      >
                        {step.output || "(no output)"}
                      </pre>
                      {step.metadata && Object.keys(step.metadata).length > 0 && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-3 py-2 font-mono text-[11px] text-muted-foreground">
                          {Object.entries(step.metadata).map(([key, value]) => (
                            <span key={key}>
                              {key}=<span className="text-foreground/80">{String(value)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </Panel>
                  </div>
                </li>
              );
            })}
            {run.status === "running" && (
              <li className="relative flex gap-4">
                <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-info/40 bg-info/10 text-info">
                  <Circle className="size-3 animate-pulse fill-current" aria-hidden="true" />
                  <span className="sr-only">running</span>
                </span>
                <p className="pt-2 text-xs text-muted-foreground">Executing the next step…</p>
              </li>
            )}
          </ol>
        )}
      </Section>
    </>
  );
}
