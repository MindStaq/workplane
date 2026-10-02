"use client";

import type { WorkplanScheduleRecord } from "@workplane/types";
import { Button, Mono, Panel, StatusBadge, Switch } from "@workplane/ui";
import { Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { browserClient, errorMessage } from "../lib/browser-client";
import { describeCron } from "../lib/format";
import { RelativeTime } from "./relative-time";

type Notice = { kind: "ok"; workplanRunId: string } | { kind: "error"; message: string };

export function ScheduleList({ schedules }: { schedules: WorkplanScheduleRecord[] }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notices, setNotices] = useState<Record<string, Notice>>({});

  useEffect(() => {
    setEnabled(Object.fromEntries(schedules.map((schedule) => [schedule.id, schedule.enabled])));
  }, [schedules]);

  async function toggle(schedule: WorkplanScheduleRecord, next: boolean) {
    setEnabled((current) => ({ ...current, [schedule.id]: next }));
    setBusy(schedule.id);
    try {
      await browserClient().updateSchedule(schedule.id, { enabled: next });
      router.refresh();
    } catch (cause) {
      setEnabled((current) => ({ ...current, [schedule.id]: schedule.enabled }));
      setNotices((current) => ({ ...current, [schedule.id]: { kind: "error", message: errorMessage(cause) } }));
    } finally {
      setBusy(null);
    }
  }

  async function runNow(schedule: WorkplanScheduleRecord) {
    setBusy(schedule.id);
    try {
      const run = await browserClient().runScheduleNow(schedule.id);
      setNotices((current) => ({ ...current, [schedule.id]: { kind: "ok", workplanRunId: run.id } }));
      router.refresh();
    } catch (cause) {
      setNotices((current) => ({ ...current, [schedule.id]: { kind: "error", message: errorMessage(cause) } }));
    } finally {
      setBusy(null);
    }
  }

  if (schedules.length === 0) {
    return <Panel className="p-8 text-center text-sm text-muted-foreground">No schedules yet.</Panel>;
  }

  return (
    <div className="flex flex-col gap-4">
      {schedules.map((schedule) => {
        const on = enabled[schedule.id] ?? schedule.enabled;
        const notice = notices[schedule.id];
        return (
          <Panel key={schedule.id}>
            <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-medium">{schedule.name}</h2>
                  <StatusBadge status={on ? "enabled" : "paused"} className="h-5" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {describeCron(schedule.cronExpression)} ({schedule.timezone}) · runs{" "}
                  <Mono className="text-foreground">{schedule.planId}</Mono>
                </p>
                {notice?.kind === "ok" && (
                  <p role="status" className="text-xs text-success">
                    Started{" "}
                    <Link href={`/workplans/${notice.workplanRunId}`} className="font-mono underline-offset-4 hover:underline">
                      {notice.workplanRunId}
                    </Link>
                  </p>
                )}
                {notice?.kind === "error" && (
                  <p role="alert" className="font-mono text-xs text-destructive">
                    {notice.message}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button size="sm" variant="outline" disabled={busy === schedule.id} onClick={() => void runNow(schedule)}>
                  <Play data-icon="inline-start" />
                  Run now
                </Button>
                <Switch
                  checked={on}
                  disabled={busy === schedule.id}
                  onCheckedChange={(next) => void toggle(schedule, next)}
                  aria-label={`${on ? "Pause" : "Enable"} ${schedule.name}`}
                />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-px border-t border-border bg-border text-xs md:grid-cols-4">
              <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                <dt className="text-muted-foreground">Cron</dt>
                <dd className="font-mono">{schedule.cronExpression}</dd>
              </div>
              <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                <dt className="text-muted-foreground">Next run</dt>
                <dd className="tabular-nums">{on && schedule.nextRunAt ? <RelativeTime iso={schedule.nextRunAt} /> : "—"}</dd>
              </div>
              <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                <dt className="text-muted-foreground">Last run</dt>
                <dd className="tabular-nums">
                  <RelativeTime iso={schedule.lastRunAt} />
                </dd>
              </div>
              <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                <dt className="text-muted-foreground">Inputs</dt>
                <dd className="truncate font-mono">
                  {Object.entries(schedule.inputs)
                    .map(([key, value]) => `${key}=${String(value)}`)
                    .join(" ") || "—"}
                </dd>
              </div>
            </dl>
          </Panel>
        );
      })}
    </div>
  );
}
