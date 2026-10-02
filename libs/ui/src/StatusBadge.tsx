import type { TaskStatus } from "@workplane/types";

export interface StatusBadgeProps {
  status: TaskStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      data-status={status}
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "var(--wp-radius)",
        border: `1px solid var(--wp-status-${status})`,
        color: `var(--wp-status-${status})`,
        fontSize: 12,
        fontFamily: "var(--wp-font-mono)",
      }}
    >
      {status}
    </span>
  );
}
