# Workplane (Local First Scaffold)

This repo now contains a local-first scaffold for Workplane with:

- Postgres-backed task/run/node/log tables
- HTTP control plane server
- polling node runtime
- basic `shell` and `aider` adapters
- CLI for submit/inspect/retry flows

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

3. Apply schema:

```bash
pnpm db:migrate
```

4. Start server:

```bash
pnpm dev:server
```

5. Start node:

```bash
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

You can filter list commands by status:

```bash
pnpm dev:cli -- tasks --status running
pnpm dev:cli -- runs --status failed
```

9. Cancel queued/running work:

```bash
pnpm dev:cli -- task cancel <taskId>
```
