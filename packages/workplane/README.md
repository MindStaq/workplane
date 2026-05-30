# workplane

[![website](https://img.shields.io/badge/website-mindstaq.github.io%2Fworkplane-3dd6c6)](https://mindstaq.github.io/workplane/)
[![npm version](https://img.shields.io/npm/v/workplane)](https://www.npmjs.com/package/workplane)
[![status](https://img.shields.io/badge/status-beta-orange)](https://github.com/MindStaq/workplane)
[![license](https://img.shields.io/npm/l/workplane)](https://github.com/MindStaq/workplane/blob/main/packages/workplane/LICENSE)

> **Beta** — Workplane v0.3.x is under active development. APIs, CLI commands, and deployment expectations may change. Not recommended for production workloads yet.

Route durable work—shell commands, local inference (Ollama), and batch agent harness jobs (Aider, Codex, Claude Code)—to capable machines on your private network. Compose multi-step workplans and run built-in agent skills locally or through the fleet.

**Requires Node.js 20+.**

## Two ways to use it

| Mode | Postgres | DBOS | What you run |
|------|----------|------|--------------|
| **Local workplans & skills** | Not required | Not used | `workplane skill run …` (inline providers; no server) |
| **Fleet control plane** | Required (`DATABASE_URL`) | Optional (`WORKPLANE_USE_DBOS=true`) | `workplane-server`, `workplane-node`, fleet CLI |

Postgres stores task/run state for the control plane only. [DBOS](https://www.dbos.dev/) adds optional crash-safe workflow replay on the server; it is **not** required to boot or route tasks. Without DBOS, the server uses plain async workflows (`VanillaWorkflows`).

## Install

```bash
npm install -g workplane
```

### Binaries

| Command | Purpose | Postgres |
|---------|---------|----------|
| `workplane` | CLI — skills, workplans, fleet task submit/inspect | Only for fleet commands |
| `workplane-server` | Control plane API | **Required** |
| `workplane-node` | Worker that polls and executes tasks | Not required |
| `workplane-db-migrate` | Apply control-plane schema | **Required** |

## Quick start — local skills (no Postgres)

Run a built-in skill inline on your machine (API keys as needed):

```bash
export ANTHROPIC_API_KEY=...   # for frontier steps
export OLLAMA_HOST=http://localhost:11434   # optional; default shown

workplane skill list
workplane skill run summarize-file --file ./README.md
workplane skill run code-review --repo . --model claude-haiku-4-5-20251001
```

No server, node, migrate step, or `DATABASE_URL` required.

## Quick start — fleet (single machine)

**1. Postgres** — any reachable instance (local Docker, managed DB, etc.). Set `DATABASE_URL`.

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
workplane-server          # no DBOS by default
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

### Optional: DBOS durability (server only)

Enable only when you want DBOS-backed workflow replay. Uses the same `DATABASE_URL` for DBOS system tables.

```bash
export WORKPLANE_USE_DBOS=true
export DBOS_APPLICATION_NAME=workplane-dev
# export DBOS_CONDUCTOR_KEY=...   # optional: DBOS Cloud observability

workplane-server
```

## Authentication

When `WORKPLANE_NODE_TOKEN` is set on the **server**, every node must use the same value. When `WORKPLANE_OPERATOR_TOKEN` is set, the CLI must send it for `task submit`, `retry`, and `cancel`.

| Variable | Used by |
|----------|---------|
| `WORKPLANE_NODE_TOKEN` | `workplane-node` |
| `WORKPLANE_OPERATOR_TOKEN` | `workplane` CLI (mutating fleet commands) |

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

## Environment reference

See [.env.example](https://github.com/MindStaq/workplane/blob/main/.env.example) in the repo for all variables, grouped by process and optional vs required.

## Documentation

- [v0.3.0 specification](https://github.com/MindStaq/workplane/blob/main/docs/specs/v0.3.0/WORKPLANE_SPEC.md)
- [Source repository](https://github.com/MindStaq/workplane)
- [Issues](https://github.com/MindStaq/workplane/issues)

## License

MIT
