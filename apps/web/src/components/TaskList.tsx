"use client";

import { WorkplaneClient } from "@workplane/client";
import type { TaskRecord } from "@workplane/types";
import { StatusBadge } from "@workplane/ui";
import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 3000;

type View =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; tasks: TaskRecord[] };

export interface TaskListProps {
  /** Overridable for tests. Defaults to the Next.js proxy route. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function TaskList({ baseUrl = "/api/workplane", fetchImpl }: TaskListProps) {
  const [view, setView] = useState<View>({ state: "loading" });

  useEffect(() => {
    const client = new WorkplaneClient({ baseUrl: baseUrl.startsWith("http") ? baseUrl : `${window.location.origin}${baseUrl}`, fetch: fetchImpl });
    let cancelled = false;

    async function refresh() {
      try {
        const { tasks } = await client.listTasks();
        if (!cancelled) {
          setView({ state: "ready", tasks });
        }
      } catch {
        if (!cancelled) {
          setView({ state: "error", message: "Cannot reach the control plane." });
        }
      }
    }

    void refresh();
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [baseUrl, fetchImpl]);

  if (view.state === "loading") {
    return <p className="muted">Loading tasks...</p>;
  }
  if (view.state === "error") {
    return (
      <p role="alert" className="banner">
        {view.message} Check that workplane-server is running and that WORKPLANE_SERVER_URL is correct.
      </p>
    );
  }
  if (view.tasks.length === 0) {
    return <p className="muted">No tasks yet.</p>;
  }
  return (
    <table aria-label="Tasks">
      <thead>
        <tr>
          <th>Task</th>
          <th>Kind</th>
          <th>Adapter</th>
          <th>Status</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>
        {view.tasks.map((task) => (
          <tr key={task.id}>
            <td>
              <code>{task.id}</code>
            </td>
            <td>{task.kind}</td>
            <td>{task.adapter}</td>
            <td>
              <StatusBadge status={task.status} />
            </td>
            <td className="muted">{new Date(task.updatedAt).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
