"use client"

import { useState } from "react"
import { CornerDownLeft, Maximize2, OctagonX, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { clockTime } from "@/lib/format"
import type { LogStream, RunInputEvent, RunLogRecord } from "@/lib/types"
import { cn } from "@/lib/utils"

const streamStyles: Record<LogStream, string> = {
  stdout: "text-foreground/90",
  stderr: "text-destructive",
  system: "text-info",
}

export function RunConsole({
  runId,
  initialLogs,
  initialEvents,
  interactive,
  live,
}: {
  runId: string
  initialLogs: RunLogRecord[]
  initialEvents: RunInputEvent[]
  interactive: boolean
  live: boolean
}) {
  const [logs, setLogs] = useState(initialLogs)
  const [events, setEvents] = useState(initialEvents)
  const [streams, setStreams] = useState<Record<LogStream, boolean>>({ stdout: true, stderr: true, system: true })
  const [draft, setDraft] = useState("")

  const visible = logs.filter((l) => streams[l.stream])
  const canSend = interactive && live

  function sendEvent(kind: RunInputEvent["kind"], payload: Record<string, unknown>, echo: string) {
    const now = new Date().toISOString()
    const sequence = events.length + 1
    setEvents((prev) => [
      ...prev,
      { id: Date.now(), runId, sequence, kind, payload, createdAt: now, deliveredAt: now },
    ])
    setLogs((prev) => [
      ...prev,
      { id: Date.now(), runId, stepName: null, stream: "system", message: `input #${sequence} delivered (${kind}${echo ? `, ${echo}` : ""})`, timestamp: now },
      ...(kind === "stdin"
        ? [{ id: Date.now() + 1, runId, stepName: null, stream: "stdout" as const, message: `> ${String(payload.data).trim()}`, timestamp: now }]
        : []),
    ])
  }

  function submitStdin() {
    if (!draft.trim()) return
    sendEvent("stdin", { data: `${draft}\n` }, `${draft.length + 1} bytes`)
    setDraft("")
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-[oklch(0.12_0.006_250)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-1" role="group" aria-label="Log streams">
          {(Object.keys(streams) as LogStream[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={streams[s]}
              onClick={() => setStreams((prev) => ({ ...prev, [s]: !prev[s] }))}
              className="rounded px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          {live && <span className="size-1.5 animate-pulse rounded-full bg-info" aria-hidden="true" />}
          {live ? "streaming" : "ended"} · {visible.length} lines
        </span>
      </div>

      <div className="max-h-[480px] min-h-64 overflow-y-auto py-2" role="log" aria-live={live ? "polite" : "off"}>
        {visible.length === 0 && <p className="px-4 py-6 font-mono text-xs text-muted-foreground">No output yet.</p>}
        {visible.map((l) => (
          <div key={l.id} className="grid grid-cols-[auto_auto_1fr] gap-3 px-4 py-px font-mono text-xs leading-relaxed hover:bg-white/[0.03]">
            <span className="text-muted-foreground/60 tabular-nums select-none">{clockTime(l.timestamp)}</span>
            <span className="w-12 text-muted-foreground/60 select-none">{l.stream}</span>
            <span className={cn("break-words whitespace-pre-wrap", streamStyles[l.stream])}>{l.message}</span>
          </div>
        ))}
      </div>

      {interactive && (
        <div className="flex flex-col gap-2 border-t border-border p-3">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              submitStdin()
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
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault()
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
            <Button size="xs" variant="outline" disabled={!canSend} onClick={() => sendEvent("signal", { signal: "SIGINT" }, "SIGINT")}>
              <Square data-icon="inline-start" />
              Ctrl-C
            </Button>
            <Button size="xs" variant="outline" disabled={!canSend} onClick={() => sendEvent("signal", { signal: "SIGTERM" }, "SIGTERM")}>
              <OctagonX data-icon="inline-start" />
              SIGTERM
            </Button>
            <Button size="xs" variant="outline" disabled={!canSend} onClick={() => sendEvent("resize", { cols: 240, rows: 60 }, "240×60")}>
              <Maximize2 data-icon="inline-start" />
              Resize 240×60
            </Button>
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">
              {events.length} input event{events.length === 1 ? "" : "s"} · PTY
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
