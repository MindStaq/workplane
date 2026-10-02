import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it.each([
    ["queued", "Queued"],
    ["running", "Running"],
    ["succeeded", "Succeeded"],
    ["failed", "Failed"],
    ["step_failed", "Step failed"],
    ["online", "Online"],
    ["paused", "Paused"],
  ] as const)("renders the %s status as %s", (status, label) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByText(label).closest("[data-status]");
    expect(badge).toHaveAttribute("data-status", status);
  });
});
