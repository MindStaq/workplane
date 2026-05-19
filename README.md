# Workplane

**Specs:** [docs/specs/v0.1.0/WORKPLANE_SPEC.md](docs/specs/v0.1.0/WORKPLANE_SPEC.md) (personal multi-node fleet: inference + batch harnesses) · [v0.2.0 planned](docs/specs/v0.2.0/WORKPLANE_SPEC.md) (interactive AI clients)

This repo contains a scaffold progressing toward v0.1.0:


- Postgres-backed task/run/node/log tables
- HTTP control plane server
- polling node runtime
- basic `shell` and `aider` adapters
- CLI for submit/inspect/retry flows

Environment variables are auto-loaded from `.env` and `.env.local` (with `.env.local` taking precedence).

## Quick Start

1. Install dependencies:

```bash
pnpm install
```

2. Set environment:

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/workplane
export WORKPLANE_SERVER_URL=http://localhost:8787
```

Or place these in `.env.local` instead of exporting them manually.

3. Apply schema:

```bash
pnpm db:migrate
```

`db:migrate` also attempts to create the target database if it does not exist.

4. Start server:

```bash
pnpm dev:server
```

5. Start node:

```bash
pnpm dev:node
```

To mirror task stdout/stderr to the node terminal during execution:

```bash
export WORKPLANE_NODE_LOG_MIRROR=true
pnpm dev:node
```

6. Submit shell task:

```bash
pnpm dev:cli -- task submit shell --command "echo hello"
```

7. Submit shell task against a repo checkout:

```bash
pnpm dev:cli -- task submit shell \
  --repo https://github.com/your-org/your-repo.git \
  --command "npm test"
```

8. Inspect run logs and artifacts:

```bash
pnpm dev:cli -- logs <runId>
pnpm dev:cli -- artifacts <runId>
```

You can also fetch logs by task id:

```bash
pnpm dev:cli -- task logs <taskId>
```

You can filter list commands by status:

```bash
pnpm dev:cli -- tasks --status running
pnpm dev:cli -- runs --status failed
```

9. Cancel queued/running work:

```bash
pnpm dev:cli -- task cancel <taskId>
```

## UAT Demo (Shell Task)

Run a one-command local UAT that:

- applies migrations
- starts server + node
- submits a shell task
- waits for terminal status
- prints run/log/artifact summary

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/workplane
pnpm uat:shell
```

Use it for real test commands:

```bash
pnpm uat:shell --command "pnpm test"
```

Use it against a repo checkout:

```bash
pnpm uat:shell \
  --repo https://github.com/your-org/your-repo.git \
  --command "npm test"
```

## Optional: Connect Local App to DBOS Conductor UI

If you have a DBOS Console account, you can connect this local app to Conductor for workflow visibility.

1. In [DBOS Console](https://console.dbos.dev), register an app name (for example `workplane-dev`).
2. Create a Conductor API key for that app.
3. Start Workplane with matching env vars:

```bash
export DBOS_APPLICATION_NAME=workplane-dev
export DBOS_CONDUCTOR_KEY=<your-conductor-api-key>
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/workplane
pnpm dev:server
```

If using self-hosted Conductor, also set:

```bash
export DBOS_CONDUCTOR_URL=ws://localhost:8090
```

## Local Submit Smoke Test

To test only local server submission (no server/node startup by the script), run:

```bash
pnpm test:submit-local
```

This checks `/healthz`, then submits a shell task with a synthetic capability requirement so it stays queued by default.

Optional:

```bash
pnpm test:submit-local --command "echo hello" --capability submit_test_only
```
