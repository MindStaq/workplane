"use client";

import type { AppendInputEventInput, RunLogRecord } from "@workplane/types";
import { Button, cn } from "@workplane/ui";
import { CornerDownLeft, Maximize2, OctagonX, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { browserClient, errorMessage } from "../lib/browser-client";
import { clockTime } from "../lib/format";
import { lastLogId, mergeLogs } from "../lib/logs";

type LogStream = RunLogRecord["stream"];

const streamStyles: Record<LogStream, string> = {
  stdout: "text-foreground/90",
  stderr: "text-destructive",
  system: "text-info",
};

const LOG_POLL_MS = 1500;

export function RunConsole({
  runId,
  initialLogs,
  eventCount,
  interactive,
  live,
}: {
  runId: string;
  initialLogs: RunLogRecord[];
  eventCount: number;
  interactive: boolean;
  live: boolean;
}) {
  const router = useRouter();
  const [logs, setLogs] = useState(initialLogs);
  const [streams, setStreams] = useState<Record<LogStream, boolean>>({ stdout: true, stderr: true, system: true });
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  const cursor = useRef(lastLogId(initialLogs));
  const scroller = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    try {
      const { logs: incoming } = await browserClient().getRunLogs(runId, { afterId: cursor.current });
      cursor.current = Math.max(cursor.current, lastLogId(incoming));
      setLogs((current) => mergeLogs(current, incoming));
      setFetchFailed(false);
    } catch {
      setFetchFailed(true);
    }
  }, [runId]);

  useEffect(() => {
    void poll();
    if (!live) return;
    const timer = setInterval(() => void poll(), LOG_POLL_MS);
    return () => clearInterval(timer);
  }, [live, poll]);

  const visible = logs.filter((log) => streams[log.stream]);
  const canSend = interactive && live;

  useEffect(() => {
    const element = scroller.current;
    if (live && element) element.scrollTop = element.scrollHeight;
  }, [visible.length, live]);

  async function send(input: AppendInputEventInput) {
    setSendError(null);
    try {
      await browserClient().sendRunInput(runId, input);
      await poll();
      router.refresh();
    } catch (cause) {
      setSendError(errorMessage(cause));
    }
  }

  async function submitStdin() {
    if (!draft.trim()) return;
    const data = `${draft}\n`;
    setDraft("");
    await send({ kind: "stdin", payload: { data } });
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-[oklch(0.12_0.006_250)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-1" role="group" aria-label="Log streams">
          {(Object.keys(streams) as LogStream[]).map((stream) => (
            <button
              key={stream}
              type="button"
              aria-pressed={streams[stream]}
              onClick={() => setStreams((previous) => ({ ...previous, [stream]: !previous[stream] }))}
              className="rounded px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
            >
              {stream}
            </button>
          ))}
        </div>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          {live && <span className="size-1.5 animate-pulse rounded-full bg-info" aria-hidden="true" />}
          {fetchFailed ? "reconnecting" : live ? "streaming" : "ended"} · {visible.length} lines
        </span>
      </div>

      <div ref={scroller} className="max-h-[480px] min-h-64 overflow-y-auto py-2" role="log" aria-live={live ? "polite" : "off"}>
        {visible.length === 0 && <p className="px-4 py-6 font-mono text-xs text-muted-foreground">No output yet.</p>}
        {visible.map((log) => (
          <div key={log.id} className="grid grid-cols-[auto_auto_1fr] gap-3 px-4 py-px font-mono text-xs leading-relaxed hover:bg-white/[0.03]">
            <span className="text-muted-foreground/60 tabular-nums select-none">{clockTime(log.timestamp)}</span>
            <span className="w-12 text-muted-foreground/60 select-none">{log.stream}</span>
            <span className={cn("break-words whitespace-pre-wrap", streamStyles[log.stream])}>{log.message}</span>
          </div>
        ))}
      </div>

      {interactive && (
        <div className="flex flex-col gap-2 border-t border-border p-3">
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submitStdin();
            }}
          >
            <label htmlFor="stdin" className="sr-only">
              Send stdin to the session
            </label>
            <span className="font-mono text-sm text-primary" aria-hidden="true">
              {">"}
            </span>
            <input
              id="stdin"
              value={draft}
              disabled={!canSend}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
              }}
              placeholder={canSend ? "Type a follow-up and press Enter…" : "Session has ended"}
              className="h-8 min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={!canSend || !draft.trim()}>
              <CornerDownLeft data-icon="inline-start" />
              Send
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="xs" variant="outline" disabled={!canSend} onClick={() => void send({ kind: "signal", payload: { signal: "SIGINT" } })}>
              <Square data-icon="inline-start" />
              Ctrl-C
            </Button>
            <Button size="xs" variant="outline" disabled={!canSend} onClick={() => void send({ kind: "signal", payload: { signal: "SIGTERM" } })}>
              <OctagonX data-icon="inline-start" />
              SIGTERM
            </Button>
            <Button size="xs" variant="outline" disabled={!canSend} onClick={() => void send({ kind: "resize", payload: { cols: 240, rows: 60 } })}>
              <Maximize2 data-icon="inline-start" />
              Resize 240×60
            </Button>
            {sendError && (
              <span role="alert" className="max-w-xs truncate font-mono text-[11px] text-destructive" title={sendError}>
                {sendError}
              </span>
            )}
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">
              {eventCount} input event{eventCount === 1 ? "" : "s"} · PTY
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
