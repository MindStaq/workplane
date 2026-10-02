import { PageHeader } from "@workplane/ui";
import type { Metadata } from "next";
import { TaskList } from "../../src/components/task-list";
import { loadTasks } from "../../src/lib/data";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const { tasks, latest, nodes } = await loadTasks();
  const rows = tasks.map((task) => {
    const run = latest.get(task.id);
    return { task, run, node: run ? nodes.get(run.nodeId) : undefined };
  });
  return (
    <>
      <PageHeader
        title="Tasks"
        description="Units of work submitted to the control plane. Each attempt to execute a task is recorded as a run."
      />
      <TaskList rows={rows} />
    </>
  );
}
