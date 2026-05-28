# Workplane v0.2.0 Implementation Plan

**Version:** 0.2.0  
**Branch:** `feature/v0.2.0`  
**Product spec:** [specs/v0.2.0/WORKPLANE_SPEC.md](../../specs/v0.2.0/WORKPLANE_SPEC.md)  
**Baseline:** v0.1.0 complete — fleet auth, shell/inference/harness adapters, CLI, UAT scripts all done.

---

## 1. Goal

Route stdin/PTY input to a running interactive agent process through the control plane, without any direct client-to-node connection.

**Definition of done:**
1. Start an interactive Claude Code task on a node.
2. Send two stdin messages through the control plane; see responses in logs.
3. Cancel; process terminates on the node.
4. No direct TCP connection from client to node at any point.

---

## 2. What already exists (relevant to v0.2.0)

| Item | Location | Notes |
|------|----------|-------|
| `WorkAdapter` interface | `packages/adapter-sdk/src/index.ts:35` | Missing `interactive`, `terminalMode` fields |
| `createCancellableExec` | `packages/adapter-sdk/src/index.ts:107` | Kill is SIGTERM only — needs escalation |
| Cancel check loop | `packages/node/src/index.ts:209` | Polls `/runs/:runId` — needs input poll alongside |
| `WorkContext` | `packages/adapter-sdk/src/index.ts:24` | No stdin write method |
| `claude-code` adapter | `packages/adapter-claude-code/src/index.ts` | Batch-only; needs PTY path |
| `codex` adapter | `packages/adapter-codex/src/index.ts` | Batch-only; needs stdio interactive path |
| Schema | `packages/db/src/schema.sql` | No `run_input_events` table |
| Server | `packages/server/src/index.ts` | No `/runs/:runId/input` routes |
| CLI | `packages/cli/src/index.ts` | No `run input` command |

---

## 3. Phases

### Phase A — Data model + server API

**Goal:** The control plane can accept and serve input events. Nothing runs interactively yet.

- [ ] **A1** Add `run_input_events` table to `packages/db/src/schema.sql`:

  ```sql
  create table if not exists run_input_events (
    id          bigserial primary key,
    run_id      text not null references runs(id),
    sequence    bigint not null,
    kind        text not null,       -- 'stdin' | 'signal' | 'resize'
    payload     jsonb not null,      -- { data: string } | { signal: string } | { rows, cols }
    created_at  timestamptz not null default now(),
    delivered_at timestamptz null
  );
  create unique index on run_input_events (run_id, sequence);
  create index on run_input_events (run_id, delivered_at) where delivered_at is null;
  ```

- [ ] **A2** Add sequence counter: `run_input_sequence` per run. Simplest approach: `select coalesce(max(sequence), 0) + 1` inside a transaction when inserting. (No separate counter table needed.)

- [ ] **A3** Add `PgStore` methods in `packages/server/src/store.ts`:
  - `appendInputEvent(runId, kind, payload): Promise<RunInputEvent>`
  - `getInputEvents(runId, afterSequence: number): Promise<RunInputEvent[]>`
  - `markInputDelivered(runId, sequence): Promise<void>`

- [ ] **A4** Add `RunInputEvent` to `packages/types/src/index.ts`:
  ```ts
  export interface RunInputEvent {
    id: number;
    runId: string;
    sequence: number;
    kind: 'stdin' | 'signal' | 'resize';
    payload: Record<string, unknown>;
    createdAt: string;
    deliveredAt: string | null;
  }
  ```

- [ ] **A5** Add server routes in `packages/server/src/index.ts`:
  - `POST /runs/:runId/input` — accepts `{ kind, payload }`, validates run is `running` and adapter is interactive (skip interactive check for now — add in Phase C when adapters are updated), requires operator token
  - `GET /runs/:runId/input?afterSequence=N` — returns events after sequence N, requires node token

- [ ] **A6** Add workflow wrappers for the two new store operations in `packages/server/src/workflows.ts` (follow existing DBOS pattern for `appendRunLogs`).

- [ ] **A7** Validation: `POST /runs/:runId/input` must reject if run status is not `running`. Return `409` with `{ error: "run is not active" }`.

- [ ] **A8** Unit tests: `packages/server/src/validation.test.ts` — input event validation (kind enum, payload shape per kind).

**Exit check:** `curl -X POST .../runs/<id>/input -d '{"kind":"stdin","payload":{"data":"hello\n"}}'` stores a row; `GET .../runs/<id>/input?afterSequence=0` returns it.

---

### Phase B — Node input poll loop

**Goal:** A running node can pick up pending input events and write them to the child process stdin.

- [ ] **B1** Extend `WorkContext` in `packages/adapter-sdk/src/index.ts` with a `writeStdin` method:
  ```ts
  writeStdin?: (data: string) => void;
  ```
  Optional — only populated when the run is interactive. Non-interactive adapters ignore it.

- [ ] **B2** In `packages/node/src/index.ts`, add `pollInputEvents` function:
  ```ts
  async function pollInputEvents(
    config, runId: string, afterSequence: number
  ): Promise<RunInputEvent[]>
  ```
  Calls `GET /runs/:runId/input?afterSequence=N` (node token auth).

- [ ] **B3** Add input dispatch loop alongside the existing cancel poll in `executeAssignment`:
  - Only starts when `adapter.interactive === true`
  - Runs on the same 2-second interval as cancel check (or finer — 500ms; TBD)
  - For each pending event:
    - `kind === 'stdin'`: call `writeStdin(payload.data)`
    - `kind === 'signal'`: call `kill(payload.signal)` — see Phase D for escalation
    - `kind === 'resize'`: resize PTY if active (Phase C)
  - After delivering each event, call `POST /runs/:runId/input/delivered` or reuse existing status endpoint to mark delivered — simplest: just mark delivered_at by calling a new `PATCH /runs/:runId/input/:sequence/delivered` endpoint (add in A5 or defer to a later cleanup)

- [ ] **B4** Track `lastDeliveredSequence` locally per run so the poll query is cheap.

- [ ] **B5** The input loop must not crash the node if the child process has already exited — guard `writeStdin` calls with a `processAlive` flag.

**Exit check:** Run a `sleep 60` shell task, post a `stdin` event to the server, observe the node log showing the event was dispatched.

---

### Phase C — PTY support

**Goal:** A node can spawn a child process with a real TTY allocation so tools like Claude Code work correctly.

- [ ] **C1** Add `node-pty` to `packages/node/package.json` (or a new `packages/adapter-sdk` optional peer dep).

- [ ] **C2** Extend `WorkContext` with a `ptyResize` method:
  ```ts
  ptyResize?: (rows: number, cols: number) => void;
  ```

- [ ] **C3** Add `createPtyExec` to `packages/adapter-sdk/src/index.ts`:
  - Spawns child with `node-pty` `pty.spawn()`
  - Captures output via `pty.onData`
  - Calls `context.log("stdout", chunk)` on each data event
  - Returns `{ exec, kill, writeStdin, ptyResize }` interface analogous to `createCancellableExec`

- [ ] **C4** `createPtyExec` must handle:
  - `kill()` with SIGTERM first, then SIGKILL after 5s grace (cancel escalation spec §3.1.7)
  - Clean exit detection (PTY emits a close/exit event)
  - Stripping ANSI escape codes before writing to run logs (optional but preferred — avoids polluting log viewer)

- [ ] **C5** Unit test for `createPtyExec` using a trivial PTY subprocess (`echo hello`). Note: PTY tests may need to be excluded from CI if no TTY is available — gate with `process.env.CI` check.

---

### Phase D — Interactive adapters

**Goal:** `claude-code` and `codex` can run as interactive sessions.

- [ ] **D1** Extend `WorkAdapter` in `packages/adapter-sdk/src/index.ts`:
  ```ts
  export interface WorkAdapter<TPayload = Record<string, unknown>> {
    name: string;
    kind: string;
    interactive?: boolean;
    terminalMode?: 'stdio' | 'pty';
    run: (context: WorkContext, payload: TPayload) => Promise<void>;
  }
  ```

- [ ] **D2** Update `packages/adapter-claude-code/src/index.ts`:
  - Add `interactive: true, terminalMode: 'pty'` to the interactive variant
  - When `payload.interactive === true`: use `createPtyExec`, pass `writeStdin` and `ptyResize` through context
  - When `payload.interactive !== true`: existing batch path unchanged
  - Single adapter export; the `interactive` payload flag picks the path

- [ ] **D3** Update `packages/adapter-codex/src/index.ts`:
  - Add `interactive: true, terminalMode: 'stdio'` to the interactive variant
  - When `payload.interactive === true`: use `createCancellableExec` with stdin pipe (not PTY — codex doesn't require TTY)
  - Batch path unchanged

- [ ] **D4** Update `packages/node/src/index.ts` to wire `writeStdin` and `ptyResize` into `WorkContext` when the adapter is interactive. The node must check `adapter.interactive` before starting the input poll loop (B3).

- [ ] **D5** Update the `POST /runs/:runId/input` server route (A5) to enforce the interactive check: fetch the run's adapter name, check `adapters[name].interactive === true`, reject with `409` if not.

  **Note:** The server doesn't import adapter packages (it shouldn't). Instead, store `interactive: boolean` on the `tasks` table when a task is created, or resolve it lazily. Simplest approach: add an `interactive` column to `tasks` (nullable boolean, default null/false) and set it during task creation when the adapter name is known.

  Alternatively, skip the server-side check entirely for v0.2.0 and let the node enforce it. Revisit if abuse becomes a concern. **Recommendation: skip server-side interactive check for v0.2.0. Node rejects silently by not starting the input loop for non-interactive adapters.**

- [ ] **D6** Cancel escalation: update `kill()` in both `createCancellableExec` and `createPtyExec` to use SIGTERM → 5s grace → SIGKILL sequence.

**Exit check (manual):** Start a claude-code interactive task on a capable node. Send a stdin event. Observe the response in logs.

---

### Phase E — CLI `run input` command

**Goal:** `workplane run input <runId>` sends a stdin event to the control plane.

- [ ] **E1** Add `run input <runId>` subcommand to `packages/cli/src/index.ts`:
  ```
  workplane run input <runId> [--stdin "text"] [--signal SIGTERM] [--resize "80x24"]
  ```
  Calls `POST /runs/:runId/input` with operator token.

- [ ] **E2** Add `--follow` to `workplane logs <runId>` (long-poll or repeated GET) so the user can watch output while sending input. This is a CLI UX improvement, not strictly v0.2.0 core — mark as optional.

- [ ] **E3** Extend `workplane run show <runId>` (or equivalent) to show `interactive: true` in output when the run uses an interactive adapter.

---

### Phase F — Tests and hardening

- [ ] **F1** Unit test: `packages/server/src/validation.test.ts` — input event kind/payload validation
- [ ] **F2** Integration test: submit interactive task → post input event → verify event retrievable (test DB, no real PTY)
- [ ] **F3** `pnpm uat:interactive` script — requires node with `claude-code` capability; marked skip if not present (same pattern as `uat:aider`)
- [ ] **F4** Update `packages/server/src/workflows.ts` DBOS wrappers for new store methods
- [ ] **F5** Update `.env.example` with no new required vars (input events use existing tokens)
- [ ] **F6** Confirm existing `pnpm test` and `pnpm uat:shell` still pass

---

## 4. Phase order and dependencies

```
A (data + API)  →  B (node input loop)  →  C (PTY)  →  D (adapters)  →  E (CLI)  →  F (tests)
```

Phases A and B are the critical path. C and D can be developed in parallel once A is done (B needs A; C needs no prior phase; D needs both A and C).

---

## 5. Key files touched

| File | Phase | Change |
|------|-------|--------|
| `packages/db/src/schema.sql` | A | Add `run_input_events` table |
| `packages/types/src/index.ts` | A | Add `RunInputEvent` type |
| `packages/server/src/store.ts` | A | 3 new methods |
| `packages/server/src/index.ts` | A, D | 2 new routes |
| `packages/server/src/workflows.ts` | A | 2 new DBOS wrappers |
| `packages/adapter-sdk/src/index.ts` | B, C | `writeStdin?`, `ptyResize?` on `WorkContext`; `interactive?`, `terminalMode?` on `WorkAdapter`; `createPtyExec` |
| `packages/node/src/index.ts` | B, D | Input poll loop; wire `writeStdin`/`ptyResize` into context |
| `packages/adapter-claude-code/src/index.ts` | D | Interactive/PTY path |
| `packages/adapter-codex/src/index.ts` | D | Interactive/stdio path |
| `packages/cli/src/index.ts` | E | `run input` command |

---

## 6. New dependency

`node-pty` — needed in `packages/node` (or `packages/adapter-sdk`) for Phase C. Native module — requires rebuild on platform change. Add to `packages/node/package.json`, not root.

---

## 7. Definition of done

Matches [specs/v0.2.0/WORKPLANE_SPEC.md §8](../../specs/v0.2.0/WORKPLANE_SPEC.md):

```bash
workplane task submit harness \
  --harness claude-code \
  --interactive \
  --repo git@github.com:you/project.git \
  --prompt "Start refactoring auth middleware"

workplane run input <runId> --stdin "Focus on tests first\n"
workplane logs <runId> --follow
```
