# Prototype intake template

Copy this file next to the prototype (`design/prototype/INTAKE.md`) and fill it in. One row per screen.

## Screens

| Screen | Route | Purpose (one line) | States shown (empty / loading / error / live) | Data needed | Interactions (buttons, forms) | Notes |
|---|---|---|---|---|---|---|
| _example: Tasks_ | `/tasks` | Browse and filter all tasks | empty, loading, error, live | tasks with status, adapter, node | filter by status, open task, retry, cancel | |
| | | | | | | |

## API mapping (filled in during review)

For each screen: which endpoint feeds it, and whether it exists today.

| Screen | Needs | Endpoint (client method) | Exists today? | Gap / action |
|---|---|---|---|---|
| Tasks list | tasks by status | `GET /tasks?status=` (`listTasks`) | yes | no pagination or sorting options |
| Task detail | task, its runs | `GET /tasks/:id`, `GET /runs?taskId=` | yes | |
| Run detail / log viewer | run, logs, artifacts | `GET /runs/:id`, `/logs?afterId=`, `/artifacts` | yes | polling only (no streaming) |
| Interactive run | send stdin / signal / resize | `POST /runs/:id/input` (`sendRunInput`) | yes | |
| Retry / cancel | task actions | `POST /tasks/:id/retry`, `/cancel` | yes | |
| Submit task | form for shell / aider / inference / harness | `POST /tasks` (`createTask`) | yes | per-kind payload schemas are not published by the API |
| Nodes | list with capabilities and heartbeat | `GET /nodes` (`listNodes`) | yes | no "stale" computation; the UI derives it from `lastHeartbeatAt` |
| Skills / workplans | list and run | `GET /skills` (`listSkills`) | list only | running a skill ad hoc through the server does not exist (see gaps) |
| Schedules | CRUD, run now | `/schedules*` | yes | |
| Workplan runs and steps | history and step outputs | `/workplan-runs*` | yes | no link from a step to the task/run it created |
| Live updates | push instead of poll | none | no | server-sent events (plan item 8.9) |

## Known API gaps (from the Phase 8 review)

These do not block the first conversion; each is its own change after the prototype is reviewed.

1. **No pagination** on `GET /tasks`, `/runs`, `/workplan-runs`: every call returns all rows. Fine for the placeholder, needed before a real fleet.
2. **No server-sent events** for run status and logs (8.9). The UI polls: logs with `?afterId=`, lists on an interval.
3. **No ad hoc skill execution through the server** (`POST /workplan-runs`, 8.10). Skills run via the CLI locally or via schedules.
4. **Workplan step results do not link to the underlying task and run** (8.10).
5. **Per-kind task payload schemas are not exposed**, so a "submit task" form hard-codes the four payload shapes (shell, aider, inference, harness).
6. **Read endpoints are open by default.** Set `WORKPLANE_PROTECT_READS=true` (and both tokens) for any network-reachable control plane; the web app's proxy always sends the operator token.
7. **No user model.** One shared operator token; there is no per-user login. The web app must itself be protected (reverse proxy, VPN, or a future auth layer) before it is exposed beyond localhost.

## Design decisions to record at conversion time

- Styling system (open decision D6)
- Data-fetching library (SWR or TanStack Query)
- Whether the web app ships inside the npm `workplane` package (a `workplane-ui` bin or a static export served by `workplane-server`) or stays separate (open decision D5)
