"use client";

import type { TaskStatus } from "@workplane/types";
import { Tabs, TabsList, TabsTrigger } from "@workplane/ui";
import { useState } from "react";
import { isActiveTask, kindGroup, type KindGroup } from "../lib/derive";
import { TasksTable, type TaskRow } from "./tables";

type StatusFilter = "all" | "active" | TaskStatus;
type KindFilter = "all" | Exclude<KindGroup, "other">;

const filters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "queued", label: "Queued" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

function matches(row: TaskRow, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return isActiveTask(row.task.status);
  return row.task.status === filter;
}

export function TaskList({ rows }: { rows: TaskRow[] }) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [kind, setKind] = useState<KindFilter>("all");

  const visible = rows.filter((row) => matches(row, filter) && (kind === "all" || kindGroup(row.task) === kind));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as StatusFilter)}>
          <TabsList variant="line" className="flex-wrap">
            {filters.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
                <span className="font-mono text-[11px] text-muted-foreground">{rows.filter((row) => matches(row, item.value)).length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={kind} onValueChange={(value) => setKind(value as KindFilter)}>
          <TabsList>
            <TabsTrigger value="all">Any kind</TabsTrigger>
            <TabsTrigger value="shell">Shell</TabsTrigger>
            <TabsTrigger value="inference">Inference</TabsTrigger>
            <TabsTrigger value="harness">Harness</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <TasksTable rows={visible} empty={rows.length === 0 ? "No tasks yet. Submit one to get started." : "No tasks match these filters"} />
    </div>
  );
}
