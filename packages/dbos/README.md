# @workplane/dbos

Optional DBOS durability layer for the workplane server. Wraps store operations in durable DBOS workflows so the control plane survives process crashes and replays in-flight operations.

## Install

```bash
npm install @workplane/dbos @workplane/types @dbos-inc/dbos-sdk
```

## Usage

Enable by setting `WORKPLANE_USE_DBOS=true` before starting the workplane server — no code changes needed. The server dynamically imports this package and swaps `VanillaWorkflows` for `DbosWorkflows`.

```bash
WORKPLANE_USE_DBOS=true workplane-server
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

- Postgres (for DBOS system tables, separate from the workplane app schema)
- `DBOS_APPLICATION_NAME` env var (optional, defaults to `workplane-server`)
