import { Mono, PageHeader, Panel, StatusBadge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@workplane/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { Elapsed, RelativeTime } from "../../src/components/relative-time";
import { loadWorkplanRuns } from "../../src/lib/data";

export const metadata: Metadata = { title: "Workplans" };

export default async function WorkplansPage() {
  const { runs, steps, schedules } = await loadWorkplanRuns();
  return (
    <>
      <PageHeader
        title="Workplans"
        description="Multi-step skill executions. Each step runs on a provider — shell, file, Ollama or a frontier model — and records its output."
      />
      <Panel>
        <Table aria-label="Workplan runs">
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
            {runs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No workplan runs yet. Run a schedule or wait for one to fire.
                </TableCell>
              </TableRow>
            )}
            {runs.map((run) => {
              const recorded = steps.get(run.id);
              const schedule = run.scheduleId ? schedules.get(run.scheduleId) : undefined;
              return (
                <TableRow key={run.id} className="group relative">
                  <TableCell className="pl-4">
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/workplans/${run.id}`} className="flex flex-col gap-0.5 outline-none after:absolute after:inset-0">
                      <span className="text-sm group-hover:text-primary">{run.planName}</span>
                      <Mono className="text-muted-foreground">{run.id}</Mono>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {recorded ? (
                      <div className="flex items-center gap-1" aria-label={`${recorded.length} steps recorded`}>
                        {recorded.map((step) => (
                          <span key={step.id} className={cn("h-1.5 w-6 rounded-full", step.exitCode === 0 ? "bg-success" : "bg-destructive")} />
                        ))}
                        {run.status === "running" && <span className="h-1.5 w-6 animate-pulse rounded-full bg-info" />}
                        {recorded.length === 0 && run.status !== "running" && <span className="text-xs text-muted-foreground">none</span>}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                    {run.scheduleId ? (schedule?.name ?? "schedule removed") : "manual"}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs tabular-nums sm:table-cell">
                    <Elapsed start={run.createdAt} end={run.endedAt} />
                  </TableCell>
                  <TableCell className="pr-4 text-right text-xs text-muted-foreground tabular-nums">
                    <RelativeTime iso={run.createdAt} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}
