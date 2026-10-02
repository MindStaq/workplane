import { PageHeader } from "@/components/workplane/primitives"
import {
  FleetPanel,
  LiveRuns,
  QueuePanel,
  RecentWorkplans,
  StatGrid,
  UpcomingSchedules,
} from "@/components/workplane/overview"

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="What is running, what is waiting, and which machines can take the next task."
      />
      <StatGrid />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <LiveRuns />
          <RecentWorkplans />
        </div>
        <div className="flex flex-col gap-8">
          <QueuePanel />
          <FleetPanel />
          <UpcomingSchedules />
        </div>
      </div>
    </>
  )
}
