import type { Metadata } from "next"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/workplane/primitives"
import { ScheduleList } from "@/components/workplane/schedule-list"
import { schedules } from "@/lib/mock-data"

export const metadata: Metadata = { title: "Schedules" }

export default function SchedulesPage() {
  return (
    <>
      <PageHeader
        title="Schedules"
        description="Cron triggers for workplans. Each fire is deduplicated with an idempotency key so restarts never double-run a plan."
        actions={
          <Button size="sm" variant="outline">
            <Plus data-icon="inline-start" />
            New schedule
          </Button>
        }
      />
      <ScheduleList schedules={schedules} />
    </>
  )
}
