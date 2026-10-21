# @workplane/mcp

MCP server for a Workplane fleet. Claude Code, Cursor and other MCP clients can list nodes, submit tasks, tail logs, steer interactive runs, fetch artifacts, run skills and manage schedules without the CLI.

## Local use (stdio)

```json
{
  "mcpServers": {
    "workplane": {
      "command": "npx",
      "args": ["-y", "@workplane/mcp"],
      "env": {
        "WORKPLANE_SERVER_URL": "http://localhost:8787",
        "WORKPLANE_OPERATOR_TOKEN": "<operator token>"
      }
    }
  }
}
```

## Hosted use (Streamable HTTP)

```bash
WORKPLANE_SERVER_URL=http://localhost:8787 npx @workplane/mcp --http --port 8788
```

Clients connect to `http://<host>:8788/mcp` and send `Authorization: Bearer <operator token>`. The token is forwarded to the control plane, so the endpoint grants nothing the token does not. It binds to `127.0.0.1` unless you pass `--host`.

## Tools

| Tool | What it does |
|---|---|
| `list_nodes` | Nodes, capabilities, status, last heartbeat |
| `submit_task` | Queue a shell, inference or harness task |
| `list_tasks`, `get_task`, `list_runs`, `get_run` | Inspect tasks and their runs |
| `tail_logs` | Run logs; pass `afterId` for only newer lines |
| `list_artifacts`, `get_artifact` | Artifacts a run produced |
| `send_run_input` | stdin, signal or resize for an interactive run |
| `cancel_task`, `retry_task` | Marked destructive so clients ask before calling |
| `list_skills`, `run_skill`, `get_workplan_run` | Run a skill now and follow its steps (each fleet step links to its task and run) |
| `list_approvals`, `approve_step`, `reject_step` | Decide gate steps that paused for approval |
| `list_schedules`, `create_schedule`, `toggle_schedule` | Cron schedules for skills |

Tools return IDs straight away. Poll `get_run`, `tail_logs` or `get_workplan_run` for progress.

## Embedding

```ts
import { createWorkplaneMcpServer } from "@workplane/mcp";

const server = createWorkplaneMcpServer({ baseUrl: "http://localhost:8787", token: process.env.WORKPLANE_OPERATOR_TOKEN });
await server.connect(transport);
```
