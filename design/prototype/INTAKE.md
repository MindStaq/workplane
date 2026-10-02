# Prototype intake: `workplane-ui-design`

Source: a v0.app export (Next.js 16, React 19, shadcn "base-nova" on `@base-ui/react`, Tailwind CSS v4, lucide icons, Geist fonts).
All data came from one module, `lib/mock-data.ts`, whose types mirror `@workplane/types`. The raw export in this folder is kept for
reference only: it is excluded from lint, build, the Nx graph and the pnpm workspace, and it never ships. The converted app lives in
`apps/web` and `libs/ui`.

## Screens

| Screen | Route | Converted to | States in the prototype | States in the app | Interactions |
|---|---|---|---|---|---|
| Overview | `/` | `app/page.tsx`, `src/components/overview.tsx` | populated | populated, per-panel empty text, control-plane-unreachable (error page) | open run / task / workplan |
| Tasks | `/tasks` | `app/tasks/page.tsx`, `task-list.tsx` | populated, filtered-empty | populated, empty, filtered-empty | filter by status and kind, open task |
| Task detail | `/tasks/[id]` | `app/tasks/[id]/page.tsx`, `task-actions.tsx` | queued / running / failed | all six statuses, not-found | cancel, retry (failed only) |
| Runs | `/runs` | `app/runs/page.tsx`, `tables.tsx` | populated | populated, empty | open run |
| Run detail | `/runs/[id]` | `app/runs/[id]/page.tsx`, `run-console.tsx` | live, ended, interactive | live (polls `?afterId=`), ended, interactive, not-found | stdin, Ctrl-C, SIGTERM, resize, cancel run |
| Nodes | `/nodes` | `app/nodes/page.tsx` | online / offline | online, offline, none registered | none |
| Workplans | `/workplans` | `app/workplans/page.tsx` | populated | populated, empty | open workplan run |
| Workplan run detail | `/workplans/[id]` | `app/workplans/[id]/page.tsx` | running / failed / completed | same, plus not-found | re-run (disabled, see gaps) |
| Schedules | `/schedules` | `app/schedules/page.tsx`, `schedule-list.tsx` | enabled / paused | enabled, paused, empty | enable/pause, run now, new (disabled, see gaps) |
| Skills | `/skills` | `app/skills/page.tsx` | populated | populated, empty | run (disabled, see gaps) |
| Submit task | dialog in the top bar | `submit-task-dialog.tsx`, `lib/submit.ts` | shell / inference / harness | same, with validation and server errors | queue task |

Every route also has a loading skeleton (`app/loading.tsx`), an error state (`app/error.tsx`) and a not-found page (`app/not-found.tsx`).

## API mapping (as built)

| Screen | Control-plane calls (all through `@workplane/client`) | Exists today? |
|---|---|---|
| Shell (sidebar, top bar) | `health`, `listNodes`, `listTasks` | yes |
| Overview | `listTasks`, `listRuns`, `listNodes`, `listSchedules`, `listWorkplanRuns`, `getRunLogs` per live run | yes |
| Tasks / task detail | `listTasks`, `listRuns`, `listNodes`, `getTask`, `listRuns({taskId})`, `cancelTask`, `retryTask` | yes |
| Run detail | `getRun`, `getTask`, `getRunLogs`, `listRunArtifacts`, `listRunInputEvents`, `sendRunInput` | yes (see "fixed" below) |
| Nodes | `listNodes`, `listRuns`, `listTasks` | yes, with reduced fields |
| Workplans | `listWorkplanRuns`, `listWorkplanSteps` per run, `getWorkplanRun`, `getSchedule`, `listSkills` | yes |
| Schedules | `listSchedules`, `updateSchedule`, `runScheduleNow` | yes |
| Skills | `listSkills`, `listWorkplanRuns` | yes, with reduced fields |
| Submit task | `createTask` | yes |

Server components call the control plane directly with the server-only operator token. Browser code (mutations, incremental log polling)
goes through the allow-listed `/api/workplane` proxy.

## Gaps found during conversion

What the prototype assumed that the API cannot supply today. Each one needs a decision before it is built.

| # | Prototype assumption | What the app does now | Proposed API change |
|---|---|---|---|
| 1 | Node cards show `host`, `network` (tailscale / wireguard / lan), `platform`, `role` and installed `models` | Shows name, id, status, heartbeat, run counts and capabilities | Nodes report hostname, platform and models at registration or heartbeat; `NodeRecord` gains optional fields |
| 2 | Sidebar footer shows control-plane version, database engine and path | Shows healthy / unreachable and the server host | `GET /healthz` returns `{ ok, version, database }` |
| 3 | A skill has typed steps (provider, model) and typed inputs (`string`, `path`, `model`) | Shows name, description and inputs from the JSON schema (`string`, `number`, `boolean`) | `SkillSummary` gains `steps: { id, name, provider, model? }[]` |
| 4 | "Run" on a skill and "Re-run plan" on a workplan run | Both buttons are visible but disabled, with an explanation | `POST /workplan-runs` (known gap 3) |
| 5 | "New schedule" opens a form | Button is disabled; the API (`POST /schedules`) exists but no form was designed | Design the form (skill picker, cron, timezone, inputs), then wire `createSchedule` |
| 6 | Retry is offered for failed **and cancelled** tasks | Retry is shown for failed tasks only; `POST /tasks/:id/retry` answers 409 for anything else | Allow retrying cancelled tasks, or keep and document the rule |
| 7 | "Cancel run" cancels a run | Cancels the run's task (`POST /tasks/:id/cancel`), which cancels the active run | `POST /runs/:id/cancel` if run-level cancel is wanted |
| 8 | Global search over tasks, runs and nodes | Input is disabled with an explanation | A search or filter endpoint, or client-side search once pagination exists |
| 9 | Workplan list shows "N of M steps" with planned steps | Shows one bar per **recorded** step (fetched for the 25 newest runs, one request each) | Include `stepCount` (and planned steps, see 3) in `GET /workplan-runs` |
| 10 | Workplan detail shows planned steps that have not run yet | Shows recorded steps, plus an "Executing the next step" row while the run is live | Same as 3 |
| 11 | Success rate "today" | Success rate over every finished run | `?since=` filter on `GET /runs` |
| 12 | Overview shows the last three log lines of a live run | Fetches the whole log for each live run and slices | `?tail=N` on `GET /runs/:id/logs` |
| 13 | Artifacts open | Shows name, type and diff stats from metadata; no preview or download | An artifact content endpoint |
| 14 | Live updates | Polling: pages re-run their server components every 5 s (paused in hidden tabs); run logs poll every 1.5 s while live | Server-sent events (known gap 2) |
| 15 | Lists are complete | Every list call returns every row | Pagination (known gap 1) |

Already listed in `docs/design/PROTOTYPE_INTAKE_TEMPLATE.md` and unchanged: no step-to-task link, no per-kind payload schemas, reads open by
default, no user model.

### Fixed during conversion

- `GET /runs/:id/input` accepted only the node token, so the operator console could not read a run's input events. It now accepts the
  operator or node token (the `read` level), the proxy allows it, and the contract test covers it.

## Changes made to the prototype on the way in

| Prototype | App | Why |
|---|---|---|
| `lib/mock-data.ts` with a frozen clock (`NOW`) | Async loaders in `src/lib/data.ts`; formatting uses the real clock (`src/lib/format.ts`) | Real data |
| Task `kind` of `shell` / `inference` / `harness` | `kind` stays `shell.exec` / `inference.batch` / `agent.run`; `kindGroup()` maps to the three families for icons, labels and filters | The API's kinds are the source of truth |
| Harness payload `{ harness, repo, prompt, interactive }` | `{ prompt, repo, interactive }` with the harness as the **adapter** (`claude-code`, `codex`, `aider`) | Matches `apps/server/src/validation.ts` |
| Default extra capability `git` for every kind | `git` only for harness tasks | A shell task should not require git by default |
| Console echoed input locally | Console posts to `sendRunInput` and shows what the node logs | Real behaviour; the PTY echoes stdin itself |
| `next/font/google` | `geist` package | Builds and CI must not need to reach Google Fonts |
| `@vercel/analytics` | Removed | A self-hosted console should not phone home |
| `typescript.ignoreBuildErrors: true` | Removed; typecheck and lint run in CI | The prototype's setting hid errors |
| `shadcn/tailwind.css` import | Vendored as `libs/ui/src/shadcn.css` | Avoids depending on the whole shadcn CLI package for one stylesheet |
| `@/` import alias | Relative imports | Matches the rest of the workspace and Nx boundary rules |
