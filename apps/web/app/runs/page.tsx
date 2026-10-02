import { PageHeader } from "@workplane/ui";
import type { Metadata } from "next";
import { RunsTable } from "../../src/components/tables";
import { loadRuns } from "../../src/lib/data";

export const metadata: Metadata = { title: "Runs" };

export default async function RunsPage() {
  const { runs, tasks, nodes } = await loadRuns();
  return (
    <>
      <PageHeader title="Runs" description="Every execution attempt across the fleet, with its node, duration and outcome." />
      <RunsTable rows={runs.map((run) => ({ run, task: tasks.get(run.taskId), node: nodes.get(run.nodeId) }))} />
    </>
  );
}
