import { Button, PageHeader } from "@workplane/ui";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { ScheduleList } from "../../src/components/schedule-list";
import { loadSchedules } from "../../src/lib/data";

export const metadata: Metadata = { title: "Schedules" };

export default async function SchedulesPage() {
  const schedules = await loadSchedules();
  return (
    <>
      <PageHeader
        title="Schedules"
        description="Cron triggers for workplans. Each fire is deduplicated with an idempotency key so restarts never double-run a plan."
        actions={
          <Button size="sm" variant="outline" disabled title="The new-schedule form is not designed yet; use the CLI (workplane schedule create)">
            <Plus data-icon="inline-start" />
            New schedule
          </Button>
        }
      />
      <ScheduleList schedules={schedules} />
    </>
  );
}
