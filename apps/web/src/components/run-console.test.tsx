import type { RunLogRecord } from "@workplane/types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const getRunLogs = vi.fn();
const sendRunInput = vi.fn();
vi.mock("../lib/browser-client", () => ({
  browserClient: () => ({ getRunLogs, sendRunInput }),
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : "failed"),
}));

import { RunConsole } from "./run-console";

function log(id: number, message: string, stream: RunLogRecord["stream"] = "stdout"): RunLogRecord {
  return { id, runId: "run_1", stepName: null, stream, message, timestamp: "2026-10-02T14:32:00Z" };
}

beforeEach(() => {
  getRunLogs.mockReset().mockResolvedValue({ logs: [] });
  sendRunInput.mockReset().mockResolvedValue({ id: 1 });
  refresh.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RunConsole", () => {
  it("renders the logs it was given and fetches only newer rows", async () => {
    getRunLogs.mockResolvedValue({ logs: [log(3, "fresh line")] });
    render(<RunConsole runId="run_1" initialLogs={[log(1, "first"), log(2, "second")]} eventCount={0} interactive={false} live />);
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(await screen.findByText("fresh line")).toBeInTheDocument();
    expect(getRunLogs).toHaveBeenCalledWith("run_1", { afterId: 2 });
  });

  it("keeps polling while the run is live and stops when it ends", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<RunConsole runId="run_1" initialLogs={[]} eventCount={0} interactive={false} live />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3200);
    });
    const whileLive = getRunLogs.mock.calls.length;
    expect(whileLive).toBeGreaterThanOrEqual(3);

    rerender(<RunConsole runId="run_1" initialLogs={[]} eventCount={0} interactive={false} live={false} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(getRunLogs.mock.calls.length).toBe(whileLive + 1);
    expect(screen.getByText(/ended/)).toBeInTheDocument();
  });

  it("filters by stream", () => {
    render(<RunConsole runId="run_1" initialLogs={[log(1, "out line"), log(2, "err line", "stderr")]} eventCount={0} interactive={false} live={false} />);
    fireEvent.click(screen.getByRole("button", { name: "stderr" }));
    expect(screen.queryByText("err line")).not.toBeInTheDocument();
    expect(screen.getByText("out line")).toBeInTheDocument();
  });

  it("sends stdin and signals through the client, and surfaces failures", async () => {
    render(<RunConsole runId="run_1" initialLogs={[]} eventCount={2} interactive live />);
    expect(screen.getByText("2 input events · PTY")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Send stdin to the session"), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await waitFor(() => expect(sendRunInput).toHaveBeenCalledWith("run_1", { kind: "stdin", payload: { data: "hello\n" } }));

    fireEvent.click(screen.getByRole("button", { name: /Ctrl-C/ }));
    await waitFor(() => expect(sendRunInput).toHaveBeenCalledWith("run_1", { kind: "signal", payload: { signal: "SIGINT" } }));

    sendRunInput.mockRejectedValueOnce(new Error("409 Conflict: run is not active"));
    fireEvent.click(screen.getByRole("button", { name: /SIGTERM/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("run is not active");
  });

  it("disables input once the session has ended", () => {
    render(<RunConsole runId="run_1" initialLogs={[]} eventCount={0} interactive live={false} />);
    expect(screen.getByLabelText("Send stdin to the session")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Ctrl-C/ })).toBeDisabled();
  });
});
