> **DEPRECATED** — Superseded by [codeplans/v0.1.0/IMPLEMENTATION_SPEC.md](../../codeplans/v0.1.0/IMPLEMENTATION_SPEC.md).

# Workplane Local-First Implementation Spec (archived)

## 1. Purpose

This spec defines how to implement Workplane locally first, with a single developer machine as the primary target.

This intentionally excludes:

- GitHub integration
- NPM publishing/release flow
- multi-machine production hardening

The goal is to prove core execution-plane behavior end-to-end before external integrations.

## 2. Local-First Success Criteria

A local implementation is complete when all of these work on one machine:

1. [DONE] Start Postgres and DBOS-backed control plane.
2. [DONE] Start one local node process with capabilities.
3. [DONE] Submit a `shell` task and see full run lifecycle.
4. [IN PROGRESS] Submit an `aider` task and capture logs + diff artifact.
5. [DONE] Retry a failed task and keep run history.
6. [DONE] Inspect task/run status and logs via CLI.

## 3. Scope for Local Phase

## In Scope

- [DONE] TypeScript monorepo setup
- [DONE] DBOS + Postgres durable orchestration
- [DONE] local control plane API
- [DONE] local polling node runtime
- [DONE] capability matching
- [DONE] per-run workspace creation
- [DONE] `shell` adapter
- [IN PROGRESS] `aider` adapter (minimal but real)
- [DONE] CLI commands for local workflows
- [DONE] filesystem artifact store
- [TODO] interactive terminal input for long-running adapter tasks

## Out of Scope (for now)

- GitHub App auth, PR creation, issue sync
- NPM packaging/publishing
- multi-node security model hardening
- Docker-required sandboxing
- dashboard UI

## 4. Local Runtime Topology

All processes run on one machine:

```text
Terminal A: Postgres
Terminal B: workplane server
Terminal C: workplane node start --capabilities ...
Terminal D: workplane CLI submit/show/logs
```

Recommended default endpoints:

- API: `http://localhost:8787`
- Postgres: `postgres://localhost:5432/workplane`
- workspace root: `.workplane/workspaces`

## 5. Proposed Repository Layout

```text
workplane/
  packages/
    core/
    server/
    node/
    cli/
    adapter-sdk/
    adapter-shell/
    adapter-aider/
    db/
    types/
  docs/
    specs/
    codeplans/
```

Local-first implementation can begin in a reduced set (`core`, `server`, `node`, `cli`, `adapter-shell`, `adapter-aider`, `db`) and split further only when needed.

## 6. Implementation Phases

## Phase 1: Bootstrap + Persistence

- [DONE] Initialize monorepo with TypeScript project references.
- [DONE] Add shared config loading (`.env`, `.env.local`, and env fallback).
- [DONE] Add Postgres connection utilities.
- [DONE] Add DB migrations for:
  - `tasks`
  - `runs`
  - `nodes`
  - `run_logs`
  - `artifacts`
- [DONE] Add DBOS initialization and workflow registration.

Exit criteria:

- [DONE] `pnpm dev:server` starts with DB connectivity.
- [DONE] migrations apply successfully on local Postgres.

## Phase 2: Control Plane API (Local)

Implement REST endpoints:

- [DONE] `POST /tasks`
- [DONE] `GET /tasks`
- [DONE] `GET /tasks/:taskId`
- [DONE] `POST /tasks/:taskId/retry`
- [DONE] `POST /tasks/:taskId/cancel`
- [DONE] `POST /nodes/register`
- [DONE] `POST /nodes/:nodeId/poll`
- [DONE] `POST /runs/:runId/status`
- [DONE] `POST /runs/:runId/logs`
- [DONE] `GET /runs/:runId/artifacts`
- [DONE] `POST /runs/:runId/artifacts`
- [TODO] `POST /runs/:runId/input`
- [TODO] `GET /runs/:runId/input?afterSequence=...`

Behavior:

- [DONE] task creation persists durable task state
- [DONE] scheduler selects compatible online node
- [DONE] run row created at assignment
- [DONE] status transitions validated

Exit criteria:

- [DONE] API-driven task submission and assignment works with mocked node polling.

## Phase 3: Local Node Runtime

- [DONE] Build node process with:
  - startup registration
  - heartbeat/poll loop
  - single active run execution
- [DONE] Add workspace manager:
  - create isolated run folder
  - create `repo/`, `logs/`, `artifacts/`, `tmp/`
  - write `metadata.json`
- [DONE] Add execution context utilities:
  - safe command execution helper
  - log append helper
  - artifact emit helper
- [TODO] Add active-run input polling for interactive tasks.
- [TODO] Add process stdin write support for running tasks.
- [TODO] Add PTY execution mode for terminal-native CLIs.

Exit criteria:

- [DONE] real node can poll, receive task, execute steps, and report status.

## Phase 4: Shell Adapter (First Real Adapter)

- [DONE] Implement `shell` adapter contract.
- [DONE] Support task input:
  - `repo` (optional)
  - `command`
  - `args` (optional)
- [DONE] Add git checkout helper (shared utility).
- [DONE] Capture stdout/stderr and exit code.
- [DONE] Mark run/task succeeded or failed.

Exit criteria:

- [DONE] `workplane task submit shell --command "echo hi"` succeeds.
- [DONE] `workplane task submit shell --command "exit 1"` fails predictably.

## Phase 5: Aider Adapter (Minimal Real Path)

- [IN PROGRESS] Implement `aider` adapter using shared adapter SDK.
- [DONE] Required input:
  - `repo`
  - `prompt`
- [DONE] Optional input:
  - `model`
  - `testCommand`
- [IN PROGRESS] Execution flow:
  1. clone repo
  2. create task branch
  3. invoke `aider`
  4. capture git diff into artifact
  5. optionally run tests

Exit criteria:

- [IN PROGRESS] local aider task creates logs and `changes.diff` artifact.

## Phase 6: CLI + Operator Experience

Add/complete commands:

- [DONE] `workplane server start`
- [DONE] `workplane node start`
- [DONE] `workplane task submit shell`
- [DONE] `workplane task submit aider`
- [DONE] `workplane tasks`
- [DONE] `workplane task show <id>`
- [DONE] `workplane runs`
- [DONE] `workplane run show <id>`
- [DONE] `workplane logs <runId>`
- [DONE] `workplane task logs <taskId>`
- [DONE] `workplane task retry <taskId>`
- [DONE] `workplane task cancel <taskId>`
- [DONE] `workplane artifacts <runId>`

Exit criteria:

- [DONE] full local demo can be run only from CLI commands.

## Phase 7: Interactive Long-Running Runs

- [TODO] Add `run_input_events` table.
- [TODO] Add monotonically increasing input event sequence per run.
- [TODO] Add `POST /runs/:runId/input`.
- [TODO] Add `GET /runs/:runId/input?afterSequence=...`.
- [TODO] Add delivered acknowledgement endpoint or delivered timestamp update.
- [TODO] Extend adapter SDK with interactive metadata:
  - `interactive?: boolean`
  - `terminalMode?: "stdio" | "pty"`
- [TODO] Extend node runtime to poll pending input events for active interactive runs.
- [TODO] Add `stdin` input support for stdio processes.
- [TODO] Add cancellation escalation:
  - send `SIGTERM`
  - wait grace period
  - send `SIGKILL`
- [TODO] Add PTY mode using a package such as `node-pty`.
- [TODO] Add terminal resize events for PTY-backed adapters.

Exit criteria:

- [TODO] A client can submit a long-running interactive shell task, send input through the control plane, and see output in run logs.
- [TODO] The implementation keeps nodes private and does not require direct client-to-node connections.

## 7. Data Model (Minimum Required Fields)

## `tasks`

- `id`
- `kind`
- `adapter`
- `payload` (JSONB)
- `requires` (text array / JSONB)
- `status`
- `created_at`
- `updated_at`

## `runs`

- `id`
- `task_id`
- `node_id`
- `attempt`
- `status`
- `started_at`
- `ended_at`
- `error` (nullable JSONB/text)

## `nodes`

- `id`
- `name`
- `capabilities`
- `status`
- `last_heartbeat_at`

## `run_logs`

- `id`
- `run_id`
- `step_name` (nullable)
- `stream` (`stdout`/`stderr`/`system`)
- `message`
- `timestamp`

## `artifacts`

- `id`
- `run_id`
- `type`
- `name`
- `path`
- `metadata`
- `created_at`

## `run_input_events`

- `id`
- `run_id`
- `sequence`
- `kind` (`stdin`/`signal`/`resize`)
- `payload` (JSONB)
- `created_at`
- `delivered_at`

## 8. Local Configuration Defaults

Example `.env` values:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/workplane
WORKPLANE_SERVER_PORT=8787
WORKPLANE_WORKSPACE_ROOT=.workplane/workspaces
WORKPLANE_NODE_NAME=local-node-1
WORKPLANE_NODE_CAPABILITIES=shell,git,node,typescript,aider
```

## 9. Testing Strategy (Local Phase)

1. **Unit tests**
   - capability matcher
   - task status transition guards
   - adapter input validation
2. **Integration tests**
   - API + DB with test schema
   - node poll + assignment
3. **E2E smoke test**
   - start services locally
   - submit shell task
   - verify logs/artifacts/status
4. **Interactive smoke test**
   - submit long-running shell task
   - send stdin through control plane
   - verify output appears in logs

Focus on deterministic local behavior before scaling complexity.

## 10. Open Decisions to Defer

These are intentionally deferred until after local-first completion:

- GitHub credentials and PR operations
- package publication strategy
- multi-node auth hardening (mTLS/OIDC)
- Docker-mandatory isolation
- hosted control plane concerns
- production-grade terminal session UI

## 11. First Demo Script

When this spec is implemented, the local demo should be:

```bash
pnpm dev:db
pnpm dev:server
pnpm dev:node

workplane task submit shell --command "npm test"
workplane tasks
workplane runs
workplane logs <runId>
```

Then:

```bash
workplane task submit aider \
  --repo <repo-url> \
  --prompt "Fix failing tests in billing module"
```

Outputs to verify:

- final task/run status
- chronological logs
- diff artifact path

Interactive demo target:

```bash
workplane task submit shell \
  --command "read line; echo received:$line" \
  --interactive

workplane run input <runId> --stdin "hello\n"
workplane logs <runId>
```

Outputs to verify:

- run remains active while waiting for input
- input is persisted as a run input event
- node receives input through polling
- output log includes `received:hello`

## 12. Definition of Done (Local-First)

Local-first implementation is done when a developer can clone the repo, run local dependencies, start server/node, submit shell and aider tasks, inspect durable state/logs/artifacts, and retry failures without manual database edits.

Interactive local-first support is done when a developer can submit a long-running interactive task, send terminal input through the control plane, and inspect both input events and output logs without connecting directly to a node.
