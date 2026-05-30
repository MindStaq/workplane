# @workplane/dbos

Optional DBOS durability layer for the workplane server. Wraps store operations in durable DBOS workflows so the control plane survives process crashes and replays in-flight operations.

The core server does **not** import this package unless `WORKPLANE_USE_DBOS=true`. Without it, workflows run as plain async calls against Postgres (`VanillaWorkflows`).

## Install

```bash
npm install @workplane/dbos @workplane/types @dbos-inc/dbos-sdk
```

## Usage

Enable by setting `WORKPLANE_USE_DBOS=true` before starting the workplane server — no code changes needed. The server dynamically imports this package and swaps `VanillaWorkflows` for `DbosWorkflows`.

```bash
export DATABASE_URL=postgres://...   # required by the server either way
export WORKPLANE_USE_DBOS=true
workplane-server
```

## Programmatic use

```ts
import { createDbosWorkflows } from "@workplane/dbos";

const workflows = createDbosWorkflows(store);  // store satisfies ServerWorkflows
await workflows.launch({
  appName: "my-app",
  systemDatabaseUrl: process.env.DATABASE_URL,
});
// workflows now implements ServerWorkflows with DBOS durability
```

## Requirements

Only when DBOS is enabled:

- Postgres — DBOS system tables (same `DATABASE_URL` as the workplane app schema by default)
- `DBOS_APPLICATION_NAME` env var (optional, defaults to `workplane-server`)
- `DBOS_CONDUCTOR_KEY` — optional; for DBOS Cloud observability

When DBOS is disabled, none of the above apply beyond the server's normal Postgres requirement for task/run state.
