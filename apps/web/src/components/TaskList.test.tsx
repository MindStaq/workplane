import { render, screen } from "@testing-library/react";
import { TaskList } from "./TaskList";

const task = (id: string, status: string) => ({
  id,
  kind: "shell.exec",
  adapter: "shell",
  payload: {},
  requires: [],
  status,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const respondWith = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("TaskList", () => {
  it("shows tasks with status badges", async () => {
    render(<TaskList fetchImpl={respondWith({ tasks: [task("task_a", "succeeded"), task("task_b", "failed")] })} />);
    expect(await screen.findByText("task_a")).toBeInTheDocument();
    expect(screen.getByText("succeeded")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    render(<TaskList fetchImpl={respondWith({ tasks: [] })} />);
    expect(await screen.findByText("No tasks yet.")).toBeInTheDocument();
  });

  it("shows a clear message when the control plane cannot be reached", async () => {
    render(<TaskList fetchImpl={respondWith({ error: "control plane unreachable" }, 502)} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach the control plane.");
  });
});
