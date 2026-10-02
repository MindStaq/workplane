import { PageHeader } from "@workplane/ui";
import { FleetPanel, LiveRuns, QueuePanel, RecentWorkplans, StatGrid, UpcomingSchedules } from "../src/components/overview";
import { loadOverview } from "../src/lib/data";
import { byId } from "../src/lib/derive";

export default async function OverviewPage() {
  const { tasks, runs, nodes, schedules, workplanRuns, tails } = await loadOverview();
  return (
    <>
      <PageHeader title="Overview" description="What is running, what is waiting, and which machines can take the next task." />
      <StatGrid runs={runs} tasks={tasks} nodes={nodes} />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <LiveRuns runs={runs} tasks={byId(tasks)} nodes={byId(nodes)} tails={tails} />
          <RecentWorkplans runs={workplanRuns} />
        </div>
        <div className="flex flex-col gap-8">
          <QueuePanel tasks={tasks} />
          <FleetPanel nodes={nodes} runs={runs} />
          <UpcomingSchedules schedules={schedules} />
        </div>
      </div>
    </>
  );
}
