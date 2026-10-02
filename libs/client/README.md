# @workplane/client

Typed HTTP client for the Workplane control plane. It only uses `fetch`, so it works in Node 20+, browsers and edge runtimes.

```ts
import { WorkplaneClient } from "@workplane/client";

const client = new WorkplaneClient({ baseUrl: "http://localhost:8787", token: process.env.WORKPLANE_OPERATOR_TOKEN });

const { tasks } = await client.listTasks({ status: "running" });
const { logs } = await client.getRunLogs(runId, { afterId: lastSeenLogId });
```

Non-2xx responses throw `WorkplaneApiError` (`status`, `path`, `body`).

Browsers should call a server-side proxy instead of holding the operator token.
