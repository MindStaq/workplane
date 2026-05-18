# Workplane Local-First Implementation Spec

## 1. Purpose

This spec defines how to implement Workplane locally first, with a single developer machine as the primary target.

This intentionally excludes:

- GitHub integration
- NPM publishing/release flow
- multi-machine production hardening

The goal is to prove core execution-plane behavior end-to-end before external integrations.

## 2. Local-First Success Criteria

A local implementation is complete when all of these work on one machine:

1. Start Postgres and DBOS-backed control plane.
2. Start one local node process with capabilities.
3. Submit a `shell` task and see full run lifecycle.
4. Submit an `aider` task and capture logs + diff artifact.
5. Retry a failed task and keep run history.
6. Inspect task/run status and logs via CLI.

## 3. Scope for Local Phase

## In Scope

- TypeScript monorepo setup
- DBOS + Postgres durable orchestration
- local control plane API
- local polling node runtime
- capability matching
- per-run workspace creation
- `shell` adapter
- `aider` adapter (minimal but real)
- CLI commands for local workflows
- filesystem artifact store

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

- Initialize monorepo with TypeScript project references.
- Add shared config loading (`workplane.config.ts` + env fallback).
- Add Postgres connection utilities.
- Add DB migrations for:
  - `tasks`
  - `runs`
  - `nodes`
  - `run_logs`
  - `artifacts`
- Add DBOS initialization and workflow registration.

Exit criteria:

- `pnpm dev:server` starts with DB connectivity.
- migrations apply successfully on local Postgres.

## Phase 2: Control Plane API (Local)

Implement REST endpoints:

- `POST /tasks`
- `GET /tasks`
- `GET /tasks/:taskId`
- `POST /tasks/:taskId/retry`
- `POST /nodes/register`
- `POST /nodes/:nodeId/poll`
- `POST /runs/:runId/status`
- `POST /runs/:runId/logs`

Behavior:

- task creation persists durable task state
- scheduler selects compatible online node
- run row created at assignment
- status transitions validated

Exit criteria:

- API-driven task submission and assignment works with mocked node polling.

## Phase 3: Local Node Runtime

- Build node process with:
  - startup registration
  - heartbeat/poll loop
  - single active run execution
- Add workspace manager:
  - create isolated run folder
  - create `repo/`, `logs/`, `artifacts/`, `tmp/`
  - write `metadata.json`
- Add execution context utilities:
  - safe command execution helper
  - log append helper
  - artifact emit helper

Exit criteria:

- real node can poll, receive task, execute steps, and report status.

## Phase 4: Shell Adapter (First Real Adapter)

- Implement `shell` adapter contract.
- Support task input:
  - `repo` (optional)
  - `command`
  - `args` (optional)
- Add git checkout helper (shared utility).
- Capture stdout/stderr and exit code.
- Mark run/task succeeded or failed.

Exit criteria:

- `workplane task submit shell --command "echo hi"` succeeds.
- `workplane task submit shell --command "exit 1"` fails predictably.

## Phase 5: Aider Adapter (Minimal Real Path)

- Implement `aider` adapter using shared adapter SDK.
- Required input:
  - `repo`
  - `prompt`
- Optional input:
  - `model`
  - `testCommand`
- Execution flow:
  1. clone repo
  2. create task branch
  3. invoke `aider`
  4. capture git diff into artifact
  5. optionally run tests

Exit criteria:

- local aider task creates logs and `changes.diff` artifact.

## Phase 6: CLI + Operator Experience

Add/complete commands:

- `workplane server start`
- `workplane node start`
- `workplane task submit shell`
- `workplane task submit aider`
- `workplane tasks`
- `workplane task show <id>`
- `workplane runs`
- `workplane run show <id>`
- `workplane logs <runId>`
- `workplane task retry <taskId>`

Exit criteria:

- full local demo can be run only from CLI commands.

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

Focus on deterministic local behavior before scaling complexity.

## 10. Open Decisions to Defer

These are intentionally deferred until after local-first completion:

- GitHub credentials and PR operations
- package publication strategy
- multi-node auth hardening (mTLS/OIDC)
- Docker-mandatory isolation
- hosted control plane concerns

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

## 12. Definition of Done (Local-First)

Local-first implementation is done when a developer can clone the repo, run local dependencies, start server/node, submit shell and aider tasks, inspect durable state/logs/artifacts, and retry failures without manual database edits.
