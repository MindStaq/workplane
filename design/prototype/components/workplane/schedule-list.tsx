"use client"

import { useState } from "react"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { describeCron, relativeTime } from "@/lib/format"
import type { WorkplanScheduleRecord } from "@/lib/types"
import { Mono, Panel } from "./primitives"
import { StatusBadge } from "./status-badge"

export function ScheduleList({ schedules }: { schedules: WorkplanScheduleRecord[] }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(schedules.map((s) => [s.id, s.enabled])),
  )

  return (
    <div className="flex flex-col gap-4">
      {schedules.map((s) => {
        const on = enabled[s.id]
        return (
          <Panel key={s.id}>
            <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-medium">{s.name}</h2>
                  <StatusBadge status={on ? "enabled" : "paused"} className="h-5" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {describeCron(s.cronExpression)} ({s.timezone}) · runs <Mono className="text-foreground">{s.planId}</Mono>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button size="sm" variant="outline">
                  <Play data-icon="inline-start" />
                  Run now
                </Button>
                <Switch
                  checked={on}
                  onCheckedChange={(v) => setEnabled((prev) => ({ ...prev, [s.id]: v }))}
                  aria-label={`${on ? "Pause" : "Enable"} ${s.name}`}
                />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-px border-t border-border bg-border text-xs md:grid-cols-4">
              <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                <dt className="text-muted-foreground">Cron</dt>
                <dd className="font-mono">{s.cronExpression}</dd>
              </div>
              <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                <dt className="text-muted-foreground">Next run</dt>
                <dd className="tabular-nums">{on && s.nextRunAt ? relativeTime(s.nextRunAt) : "—"}</dd>
              </div>
              <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                <dt className="text-muted-foreground">Last run</dt>
                <dd className="tabular-nums">{relativeTime(s.lastRunAt)}</dd>
              </div>
              <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                <dt className="text-muted-foreground">Inputs</dt>
                <dd className="truncate font-mono">
                  {Object.entries(s.inputs)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(" ")}
                </dd>
              </div>
            </dl>
          </Panel>
        )
      })}
    </div>
  )
}
