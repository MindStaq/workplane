import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const cancelTask = vi.fn();
const retryTask = vi.fn();
vi.mock("../lib/browser-client", () => ({
  browserClient: () => ({ cancelTask, retryTask }),
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : "failed"),
}));

import { TaskActions } from "./task-actions";

beforeEach(() => {
  refresh.mockReset();
  cancelTask.mockReset().mockResolvedValue({});
  retryTask.mockReset().mockResolvedValue({});
});

describe("TaskActions", () => {
  it("only renders the actions the task state allows", () => {
    const { rerender } = render(<TaskActions taskId="task_1" canCancel canRetry={false} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();

    rerender(<TaskActions taskId="task_1" canCancel={false} canRetry />);
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("cancels and retries through the client, then refreshes the page data", async () => {
    render(<TaskActions taskId="task_1" canCancel canRetry />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(cancelTask).toHaveBeenCalledWith("task_1"));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(retryTask).toHaveBeenCalledWith("task_1"));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
  });

  it("shows the control plane's refusal instead of failing silently", async () => {
    retryTask.mockRejectedValueOnce(new Error("task is not retryable"));
    render(<TaskActions taskId="task_1" canCancel={false} canRetry />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("task is not retryable");
    expect(refresh).not.toHaveBeenCalled();
  });
});
