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
| B — Node input poll loop | Not started | |
| C — PTY support | Not started | |
| D — Interactive adapters | Not started | |
| E — CLI `run input` command | Not started | |
| F — Tests and hardening | Not started | |

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
