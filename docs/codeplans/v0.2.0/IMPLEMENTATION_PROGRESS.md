# v0.2.0 Implementation Progress

**Branch:** `feature/v0.2.0`  
**Spec:** [IMPLEMENTATION_SPEC.md](./IMPLEMENTATION_SPEC.md)

---

## Summary

Interactive AI client workloads — PTY/stdin routing through the control plane.

## Phase checklist

| Phase | Status | Notes |
|-------|--------|-------|
| A — Data model + server API | Done | 17/17 tests passing |
| B — Node input poll loop | Done | 19/19 tests passing |
| C — PTY support | Done | 22/23 tests passing (1 skipped: needs real TTY) |
| D — Interactive adapters | Done | 22/23 tests passing (1 skipped: needs real TTY) |
| E — CLI `run input` command | Done | 22/23 tests passing (1 skipped: needs real TTY) |
| F — Tests and hardening | Done | 22/23 tests passing; uat:interactive script added |

---

## Phase A log

### A1 — `run_input_events` schema
- Added table with `id` (bigserial), `run_id`, `sequence`, `kind`, `payload`, `created_at`, `delivered_at`
- Unique index on `(run_id, sequence)`; partial index on undelivered events

### A2 — Sequence counter
- Sequence assigned via `coalesce(max(sequence), 0) + 1` inside a transaction in `appendInputEvent`

### A3 — `PgStore` methods
- `appendInputEvent(runId, input)` — inserts event, returns `RunInputEvent`
- `getInputEvents(runId, afterSequence)` — returns events ordered by sequence
- `markInputDelivered(runId, sequence)` — sets `delivered_at = now()`

### A4 — Types
- Added `InputEventKind`, `RunInputEvent`, `AppendInputEventInput` to `packages/types/src/index.ts`

### A5 — Server routes
- `POST /runs/:runId/input` — operator auth; validates run is `running`; 409 if not active
- `GET /runs/:runId/input?afterSequence=N` — node auth; returns pending events
- `POST /runs/:runId/input/:sequence/delivered` — node auth; marks delivered

### A6 — DBOS wrappers
- `appendInputEvent` and `markInputDelivered` registered as DBOS workflows in `workflows.ts`
- `getInputEvents` is a read — plain store call (no workflow wrapper needed)

### A7 — Active-run guard
- `POST /runs/:runId/input` fetches run status; returns 404 if run not found, 409 if not `running`

### A8 — Tests
- `validateInputEvent` tests in `validation.test.ts`: stdin/signal/resize accepted; bad kind rejected; wrong payload shape rejected

---

## Phase B log

### B1 — `WorkContext` extensions
- Added `writeStdin?: (data: string) => void` and `ptyResize?: (rows: number, cols: number) => void` to `WorkContext`
- `ptyResize` is a placeholder for Phase C; not wired yet

### B2 — `WorkAdapter` extensions (D1 pull-forward)
- Added `interactive?: boolean` and `terminalMode?: "stdio" | "pty"` to `WorkAdapter`

### B3 — `createCancellableExec` updates
- `kill()` now accepts optional `signal?: NodeJS.Signals` (defaults to SIGTERM)
- Added `writeStdin(data)` — writes to `activeChild.stdin`; no-op if child is dead, killed, or stdin destroyed
- Returns `{ exec, kill, writeStdin }`

### B4 — `pollInputEvents` + `markDelivered` node helpers
- `pollInputEvents(config, runId, afterSequence)` — GET /runs/:id/input?afterSequence=N (node auth)
- `markDelivered(config, runId, sequence)` — POST /runs/:id/input/:seq/delivered (node auth)

### B5 — Input poll loop in `executeAssignment`
- Loop starts only when `adapter.interactive === true`; 500ms interval
- `stdin` events: calls `writeStdin(payload.data)`
- `signal` events: calls `kill(payload.signal)`
- `resize` events: logged as no-op until Phase C (PTY)
- Each event marked delivered after dispatch; `lastInputSequence` tracks position
- Interval cleared in `finally` alongside cancel interval
- `writeStdin` wired into `WorkContext` for interactive adapters

### B6 — Tests
- `packages/adapter-sdk/src/index.test.ts`: `writeStdin` no-op when no child; `kill` no-op when no child
- Added `packages/adapter-sdk/src/*.test.ts` to `pnpm test` command

---

## Phase C log

### C1 — `node-pty` dependency
- Added `node-pty ^1.1.0` to root `package.json`

### C2 — `packages/node/src/env.ts`
- Extracted `pickNodeEnv(allowlist)` as a node-local helper (mirrors `pickEnv` in adapter-sdk without exporting internals)

### C3 — `packages/node/src/pty-exec.ts`
- `createPtyExec(context)` → `{ exec, kill, writeStdin, ptyResize }`
- Spawns via `node-pty` with `cols: 220, rows: 50, TERM: xterm-256color`
- `onData`: strips ANSI escape sequences before calling `context.log("stdout", ...)`
- `onExit`: resolves promise; clears kill escalation timer
- `kill(signal)`: SIGTERM → 5s grace → SIGKILL (escalation; deferred for `createCancellableExec` to Phase D)
- `writeStdin(data)`: `pty.write(data)`, no-op when no active PTY
- `ptyResize(rows, cols)`: `pty.resize(cols, rows)`, no-op when no active PTY

### C4 — `executeAssignment` updates
- **Bug fix**: `createCancellableExec` (and `createPtyExec`) now both receive the real `logFn` instead of the previous no-op dummy context — subprocess stdout/stderr now streams to run logs
- `usePty = adapter.terminalMode === "pty"` selects `createPtyExec` vs `createCancellableExec`
- `ptyResize` wired into `WorkContext` for PTY interactive adapters
- Resize events in input poll loop now call `ptyResize(rows, cols)` (previously a no-op comment)

### C5 — Tests
- `packages/node/src/pty-exec.test.ts`: 3 no-op guard tests + 1 integration test (skipped when `!stdout.isTTY`)
- Added `packages/node/src/*.test.ts` to `pnpm test` command

---

## Phase D log

### D1 — `WorkAdapter` extensions (already pulled into Phase B)
- `interactive?: boolean` and `terminalMode?: "stdio" | "pty"` already on `WorkAdapter` interface

### D2 — `HarnessPayload` + validation
- Added `interactive?: boolean` to `HarnessPayload` in `packages/adapter-harness/src/index.ts`
- Added `interactive: z.boolean().optional()` to `harnessPayloadSchema` in `packages/server/src/validation.ts`

### D3 — `HarnessAdapterOptions` interactive support
- Added `interactive?`, `terminalMode?`, `buildInteractiveArgs?` to `HarnessAdapterOptions`
- `createHarnessAdapter` sets `interactive` and `terminalMode` on returned adapter object
- Interactive path in `run()`: calls `buildInteractiveArgs`, starts exec without awaiting, waits 300ms for process init, sends `payload.prompt + "\n"` via `context.writeStdin`, then awaits result + captures git diff
- Batch path unchanged (existing logic with `buildArgs`)

### D4 — `claudeCodeAdapter` interactive wiring
- `interactive: true, terminalMode: "pty"`
- `buildArgs`: `-p prompt --output-format text [--model X] [...extraArgs]` (batch)
- `buildInteractiveArgs`: `[--model X] [...extraArgs]` — no `-p` or `--output-format text`

### D5 — `codexAdapter` interactive wiring
- `interactive: true, terminalMode: "stdio"`
- `buildArgs`: `[--approval-mode full-auto] [--model X] prompt` (batch)
- `buildInteractiveArgs`: `[extraArgs] [--model X]` — no `--approval-mode full-auto` and no prompt arg

### D6 — `createCancellableExec` kill escalation
- `kill(SIGTERM)` now schedules a 5s escalation to SIGKILL via `setTimeout(...).unref()`
- Matches PTY exec escalation behavior from Phase C

### D7 — Node gating
- `isInteractive = task.payload.interactive === true` derived once
- `usePty = adapter.terminalMode === "pty" && isInteractive`
- Input poll loop: `adapter.interactive && isInteractive`
- `writeStdin` / `ptyResize` on context: `adapter.interactive && isInteractive`

---

## Phase E log

### E1 — `run input` CLI command
- `run input <runId> --stdin <text>` → `POST /runs/:id/input` with `{ kind: "stdin", payload: { data } }`
- `run input <runId> --signal <SIGTERM|SIGKILL|SIGINT>` → signal event; validates allowed values
- `run input <runId> --resize <COLSxROWS>` → resize event; parses `220x50` format as cols×rows
- All three paths: operator auth; prints JSON response

### E2 — `--interactive` flag on `task submit harness`
- `task submit harness --harness <codex|claude-code> ... --interactive` sets `payload.interactive: true`
- Without flag, `interactive` is `undefined` → batch mode

### E3 — Usage string updated
- Added `run input` variants and `[--interactive]` flag to harness submit in help text

---

## Phase F log

### F1 — Validation unit tests
- Already covered by Phase A: `validateInputEvent` tests for all three kinds in `validation.test.ts`

### F2 — Integration coverage
- Input event store methods and routes covered end-to-end by UAT script (F3)
- Unit test count: 22/23 (1 skipped: PTY integration test needs real TTY)

### F3 — `pnpm uat:interactive`
- `scripts/uat-interactive-task.ts`: submits interactive task, waits for `running`, sends `exit\n` via stdin, waits for completion
- Skips gracefully if binary (`claude` or `codex`) not on PATH
- `--harness`, `--repo`, `--prompt`, `--branch` flags; falls back to `UAT_REPO` env
- Added `getRunIdForTask`, `waitForRunStatus`, `sendRunInput` helpers to `scripts/uat-common.ts`

### F4 — DBOS wrappers
- Already covered by Phase A: `appendInputEvent` and `markInputDelivered` registered as DBOS workflows

### F5 — `.env.example`
- No new required vars — input events use existing `WORKPLANE_OPERATOR_TOKEN` and `WORKPLANE_NODE_TOKEN`

### F6 — Regression check
- `pnpm test`: 22/23 pass (unchanged from Phase C baseline)
- All prior phases (A–E) consolidated without regressions
