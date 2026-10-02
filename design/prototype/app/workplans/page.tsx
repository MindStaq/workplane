import type { Metadata } from "next"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Mono, PageHeader, Panel } from "@/components/workplane/primitives"
import { StatusBadge } from "@/components/workplane/status-badge"
import { getSchedule, getStepsForWorkplanRun, getSkill, workplanRuns } from "@/lib/mock-data"
import { duration, relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Workplans" }

export default function WorkplansPage() {
  return (
    <>
      <PageHeader
        title="Workplans"
        description="Multi-step skill executions. Each step runs on a provider — shell, file, Ollama or a frontier model — and records its output."
      />
      <Panel>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-36 pl-4">Status</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="hidden md:table-cell">Steps</TableHead>
              <TableHead className="hidden lg:table-cell">Trigger</TableHead>
              <TableHead className="hidden sm:table-cell">Duration</TableHead>
              <TableHead className="pr-4 text-right">Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workplanRuns.map((w) => {
              const steps = getStepsForWorkplanRun(w.id)
              const total = getSkill(w.planId)?.steps.length ?? steps.length
              const schedule = w.scheduleId ? getSchedule(w.scheduleId) : undefined
              return (
                <TableRow key={w.id} className="group relative">
                  <TableCell className="pl-4">
                    <StatusBadge status={w.status} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/workplans/${w.id}`} className="flex flex-col gap-0.5 outline-none after:absolute after:inset-0">
                      <span className="text-sm group-hover:text-primary">{w.planName}</span>
                      <Mono className="text-muted-foreground">{w.id}</Mono>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-1" aria-label={`${steps.length} of ${total} steps recorded`}>
                      {Array.from({ length: total }).map((_, i) => {
                        const s = steps[i]
                        return (
                          <span
                            key={i}
                            className={cn(
                              "h-1.5 w-6 rounded-full",
                              !s ? "bg-muted" : s.exitCode === 0 ? "bg-success" : "bg-destructive",
                            )}
                          />
                        )
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                    {schedule ? schedule.name : "manual"}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs tabular-nums sm:table-cell">
                    {duration(w.createdAt, w.endedAt)}
                  </TableCell>
                  <TableCell className="pr-4 text-right text-xs text-muted-foreground tabular-nums">
                    {relativeTime(w.createdAt)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Panel>
    </>
  )
}
