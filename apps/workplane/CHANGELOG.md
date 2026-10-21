# workplane

## 0.6.0

### Minor Changes

- v0.6.0: an agent-operable fleet.

  - New `@workplane/mcp` package: an MCP server over the operator API, with stdio (`npx @workplane/mcp`) and Streamable HTTP transports. Cancel, retry and approval tools are annotated as destructive so clients can ask before calling them.
  - `POST /workplan-runs` runs a skill on demand and returns the workplan run ID. Each step result records its status and, for fleet steps, the task and run it created. The client SDK gains `startWorkplanRun`, and the CLI gains `workplan-run start`.
  - Workplans can be graphs: `dependsOn`, parallel branches capped by `maxParallel` (default 4), `when:` conditions over earlier steps' output, exit code and status, `{{steps.<id>.output}}` templates, and `gate` steps that pass, fail or pause for approval (`GET /workplan-runs/:id/approvals`, `POST …/steps/:stepId/approve|reject`). Plans are validated (unknown IDs, cycles, bad conditions) before they run. Plans without `dependsOn` still run in order.
  - A step whose command exits non-zero now fails the step.
  - Postgres: nodes now receive tasks whose `requires` are a subset of their capabilities. Previously a node got a task only if the task required every capability the node advertised.
  - `workplane-node` retries registration with backoff instead of exiting, and re-registers when the server no longer recognises it (polls for unknown nodes now return 404).
  - `workplane-setup` can be scripted: `--yes`/`--non-interactive`, a flag or env var for every prompt, and `--no-migrate`.
  - `@workplane/adapter-claude-code` and `@workplane/adapter-codex` declare their `@workplane/adapter-sdk` dependency.
  - Database migration: `workplan_runs.inputs` and `workplan_step_results.status`, `task_id` and `run_id`. Run `workplane-db-migrate` after upgrading.

## 0.5.0

### Minor Changes

- 54d4e7b: v0.5.0: Nx workspace, operator API additions, and the groundwork for the web console.

  - The repository is now an Nx workspace (`apps/` and `libs/`). Published packages are built by the same tooling as before and ship the same file lists.
  - New operator endpoints: `GET /nodes`, `GET /skills` (with input schemas) and `GET /runs/:id/logs?afterId=` for incremental log reads.
  - `GET /runs/:id/input` now accepts the operator token as well as the node token.
  - Opt-in CORS (`WORKPLANE_CORS_ORIGINS`) and opt-in authenticated reads (`WORKPLANE_PROTECT_READS=true`).
  - The CLI talks to the control plane through a typed client; its output is unchanged.
