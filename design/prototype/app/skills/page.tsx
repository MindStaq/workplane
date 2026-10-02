import type { Metadata } from "next"
import { ArrowRight, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Mono, PageHeader, Panel } from "@/components/workplane/primitives"
import { skills, workplanRuns } from "@/lib/mock-data"
import { relativeTime } from "@/lib/format"

export const metadata: Metadata = { title: "Skills" }

export default function SkillsPage() {
  return (
    <>
      <PageHeader
        title="Skills"
        description="Reusable workplan definitions loaded from the skill registry. Run one ad hoc or attach it to a schedule."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {skills.map((skill) => {
          const lastRun = workplanRuns.find((w) => w.planId === skill.id)
          return (
            <Panel key={skill.id} className="flex flex-col">
              <div className="flex flex-col gap-1.5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-medium">{skill.name}</h2>
                  <Mono className="text-muted-foreground">{skill.id}</Mono>
                </div>
                <p className="text-pretty text-sm text-muted-foreground">{skill.description}</p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 border-y border-border bg-muted/20 px-4 py-3">
                {skill.steps.map((step, i) => (
                  <span key={step.id} className="flex items-center gap-1.5">
                    {i > 0 && <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />}
                    <span className="rounded border border-border bg-card px-1.5 py-0.5 text-xs">
                      {step.name}
                      <span className="ml-1 font-mono text-[10px] text-muted-foreground">{step.provider}</span>
                    </span>
                  </span>
                ))}
              </div>

              <dl className="flex flex-1 flex-col gap-2.5 p-4">
                {skill.inputs.map((input) => (
                  <div key={input.name} className="flex items-baseline justify-between gap-3 text-xs">
                    <dt className="flex items-baseline gap-1.5">
                      <span className="font-mono text-foreground">{input.name}</span>
                      {input.required && <span className="text-destructive">*</span>}
                      <span className="font-mono text-muted-foreground">{input.type}</span>
                    </dt>
                    <dd className="truncate text-right font-mono text-muted-foreground">{input.default ?? "—"}</dd>
                  </div>
                ))}
              </dl>

              <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  {lastRun ? `Last run ${relativeTime(lastRun.createdAt)}` : "Never run"}
                </span>
                <Button size="sm" variant="secondary">
                  <Play data-icon="inline-start" />
                  Run
                </Button>
              </div>
            </Panel>
          )
        })}
      </div>
    </>
  )
}
