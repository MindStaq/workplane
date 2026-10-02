import { cn } from "@/lib/utils"
import type { TaskStatus, WorkplanRunStatus } from "@/lib/types"

type Status = TaskStatus | WorkplanRunStatus | "online" | "offline" | "enabled" | "paused"

const styles: Record<Status, { dot: string; text: string; label: string; pulse?: boolean }> = {
  queued: { dot: "bg-muted-foreground", text: "text-muted-foreground", label: "Queued" },
  assigned: { dot: "bg-warning", text: "text-warning", label: "Assigned" },
  running: { dot: "bg-info", text: "text-info", label: "Running", pulse: true },
  succeeded: { dot: "bg-success", text: "text-success", label: "Succeeded" },
  completed: { dot: "bg-success", text: "text-success", label: "Completed" },
  failed: { dot: "bg-destructive", text: "text-destructive", label: "Failed" },
  step_failed: { dot: "bg-destructive", text: "text-destructive", label: "Step failed" },
  cancelled: { dot: "bg-muted-foreground/60", text: "text-muted-foreground", label: "Cancelled" },
  online: { dot: "bg-success", text: "text-success", label: "Online", pulse: true },
  offline: { dot: "bg-muted-foreground/60", text: "text-muted-foreground", label: "Offline" },
  enabled: { dot: "bg-success", text: "text-success", label: "Enabled" },
  paused: { dot: "bg-muted-foreground/60", text: "text-muted-foreground", label: "Paused" },
}

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  const s = styles[status]
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)} aria-hidden="true">
      {s.pulse && <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", s.dot)} />}
      <span className={cn("relative inline-flex size-2 rounded-full", s.dot)} />
    </span>
  )
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const s = styles[status]
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 text-xs font-medium",
        s.text,
        className,
      )}
    >
      <StatusDot status={status} />
      {s.label}
    </span>
  )
}
