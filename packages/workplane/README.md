# workplane

[![npm version](https://img.shields.io/npm/v/workplane)](https://www.npmjs.com/package/workplane)
[![status](https://img.shields.io/badge/status-beta-orange)](https://github.com/MindStaq/workplane)
[![license](https://img.shields.io/npm/l/workplane)](https://github.com/MindStaq/workplane/blob/main/packages/workplane/LICENSE)

> **Beta** — Workplane v0.1.x is under active development. APIs, CLI commands, and deployment expectations may change. Not recommended for production workloads yet.

Route durable work—shell commands, local inference (Ollama), and batch agent harness jobs (Aider, Codex, Claude Code)—to capable machines on your private network.

Workplane is a control plane + polling node runtime backed by Postgres and [DBOS](https://www.dbos.dev/). You submit tasks from a CLI; nodes pull work, run it in isolated workspaces, and report logs and artifacts.

**Requires Node.js 20+** and **Postgres**.

## Install

```bash
npm install -g workplane
```

### Binaries

| Command | Purpose |
|---------|---------|
| `workplane` | CLI — submit and inspect tasks |
| `workplane-server` | Control plane API |
| `workplane-node` | Worker that polls and executes tasks |
| `workplane-db-migrate` | Apply database schema |

## Quick start (single machine)

**1. Postgres** — running locally or reachable via `DATABASE_URL`.

**2. Environment** — create a `.env` file or export:

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/workplane
export WORKPLANE_SERVER_URL=http://localhost:8787

# Recommended when the server is not localhost-only:
export WORKPLANE_NODE_TOKEN=your-node-secret
export WORKPLANE_OPERATOR_TOKEN=your-operator-secret
```

**3. Migrate, server, node** (three terminals):

```bash
workplane-db-migrate
workplane-server
workplane-node
```

**4. Submit a task** (fourth terminal):

```bash
export WORKPLANE_OPERATOR_TOKEN=your-operator-secret   # if auth enabled on server

workplane task submit shell --command "echo hello"
workplane tasks
workplane runs
workplane logs <runId>
```

## Authentication

When `WORKPLANE_NODE_TOKEN` is set on the **server**, every node must use the same value. When `WORKPLANE_OPERATOR_TOKEN` is set, the CLI must send it for `task submit`, `retry`, and `cancel`.

| Variable | Used by |
|----------|---------|
| `WORKPLANE_NODE_TOKEN` | `workplane-node` |
| `WORKPLANE_OPERATOR_TOKEN` | `workplane` CLI (mutating commands) |

Read-only CLI commands (`tasks`, `logs`, `runs`, …) work without the operator token unless you add stricter rules in your deployment.

## CLI examples

```bash
# Shell
workplane task submit shell --command "npm test" \
  --repo https://github.com/you/your-repo.git

# Local inference (node must advertise ollama capability)
workplane task submit inference --model llama3.2 --prompt "Say hello"

# Agent harness (node must have codex or claude-code installed)
workplane task submit harness --harness codex \
  --repo git@github.com:you/app.git \
  --prompt "Fix failing tests"

workplane task submit aider \
  --repo git@github.com:you/app.git \
  --prompt "Fix the bug" \
  --test-command "npm test"

workplane task retry <taskId>
workplane task cancel <taskId>
workplane artifacts <runId>
```

## Node capabilities

Register capabilities when starting a node:

```bash
export WORKPLANE_NODE_CAPABILITIES=shell,git,ollama,aider,codex,claude-code
workplane-node
```

Tasks declare `requires`; the control plane assigns work to a node whose capabilities are a superset.

| Adapter | Typical capabilities |
|---------|----------------------|
| Shell | `shell` |
| Ollama | `ollama` |
| Aider | `git`, `aider` |
| Codex | `git`, `codex` |
| Claude Code | `git`, `claude-code` |

Override harness binaries: `WORKPLANE_CODEX_BIN`, `WORKPLANE_CLAUDE_CODE_BIN`.

## Personal fleet (home + office)

Run the control plane on an always-on host (VPS, NAS, or home server). Run nodes on each machine where tools or GPUs live. Connect machines with Tailscale, WireGuard, or a trusted LAN.

Set `WORKPLANE_SERVER_URL` to the control plane’s reachable URL on every node and CLI client.

Full deployment guide: [github.com/MindStaq/workplane/blob/main/docs/deployment/FLEET.md](https://github.com/MindStaq/workplane/blob/main/docs/deployment/FLEET.md)

## Documentation

- [v0.1.0 specification](https://github.com/MindStaq/workplane/blob/main/docs/specs/v0.1.0/WORKPLANE_SPEC.md)
- [Source repository](https://github.com/MindStaq/workplane)
- [Issues](https://github.com/MindStaq/workplane/issues)

## License

MIT
