"use client";

import { Button } from "@workplane/ui";
import { Ban, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient, errorMessage } from "../lib/browser-client";

type Action = "cancel" | "retry";

/** Cancel and retry for a task, shared by the task page and the run page (a run is cancelled by cancelling its task). */
export function TaskActions({
  taskId,
  canCancel,
  canRetry,
  cancelLabel = "Cancel",
}: {
  taskId: string;
  canCancel: boolean;
  canRetry: boolean;
  cancelLabel?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    setPending(action);
    setError(null);
    try {
      const client = browserClient();
      await (action === "cancel" ? client.cancelTask(taskId) : client.retryTask(taskId));
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      {error && (
        <span role="alert" className="max-w-xs truncate font-mono text-xs text-destructive" title={error}>
          {error}
        </span>
      )}
      {canCancel && (
        <Button variant="outline" size="sm" disabled={pending !== null} onClick={() => void run("cancel")}>
          <Ban data-icon="inline-start" />
          {pending === "cancel" ? "Cancelling…" : cancelLabel}
        </Button>
      )}
      {canRetry && (
        <Button size="sm" disabled={pending !== null} onClick={() => void run("retry")}>
          <RotateCcw data-icon="inline-start" />
          {pending === "retry" ? "Retrying…" : "Retry"}
        </Button>
      )}
    </>
  );
}
