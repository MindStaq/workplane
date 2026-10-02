import type { Metadata } from "next"
import { PageHeader } from "@/components/workplane/primitives"
import { TaskList } from "@/components/workplane/task-list"
import { tasks } from "@/lib/mock-data"

export const metadata: Metadata = { title: "Tasks" }

export default function TasksPage() {
  return (
    <>
      <PageHeader
        title="Tasks"
        description="Units of work submitted to the control plane. Each attempt to execute a task is recorded as a run."
      />
      <TaskList tasks={tasks} />
    </>
  )
}
