import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it.each(["queued", "running", "succeeded", "failed"] as const)("renders the %s status", (status) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByText(status);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-status", status);
  });
});
