"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { TaskRecord, TaskStatus } from "@/lib/types"
import { TasksTable } from "./tables"

const filters: { value: "all" | TaskStatus | "active"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "queued", label: "Queued" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
]

export function TaskList({ tasks }: { tasks: TaskRecord[] }) {
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all")
  const [kind, setKind] = useState<"all" | "shell" | "inference" | "harness">("all")

  const visible = tasks.filter((t) => {
    const statusOk =
      filter === "all" ? true : filter === "active" ? t.status === "running" || t.status === "assigned" : t.status === filter
    return statusOk && (kind === "all" || t.kind === kind)
  })

  const count = (v: (typeof filters)[number]["value"]) =>
    v === "all"
      ? tasks.length
      : v === "active"
        ? tasks.filter((t) => t.status === "running" || t.status === "assigned").length
        : tasks.filter((t) => t.status === v).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList variant="line" className="flex-wrap">
            {filters.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
                <span className="font-mono text-[11px] text-muted-foreground">{count(f.value)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
          <TabsList>
            <TabsTrigger value="all">Any kind</TabsTrigger>
            <TabsTrigger value="shell">Shell</TabsTrigger>
            <TabsTrigger value="inference">Inference</TabsTrigger>
            <TabsTrigger value="harness">Harness</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <TasksTable tasks={visible} empty="No tasks match these filters" />
    </div>
  )
}
