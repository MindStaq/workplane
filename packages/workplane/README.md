# workplane

[![website](https://img.shields.io/badge/website-workplane.dev-3dd6c6)](https://mindstaq.github.io/workplane/)
[![npm version](https://img.shields.io/npm/v/workplane)](https://www.npmjs.com/package/workplane)
[![status](https://img.shields.io/badge/status-alpha-orange)](https://github.com/MindStaq/workplane)
[![license](https://img.shields.io/npm/l/workplane)](https://github.com/MindStaq/workplane/blob/main/packages/workplane/LICENSE)

> **Alpha software.** APIs and data models are unstable and will change between releases. Not recommended for production use.

Route durable work to capable nodes on your private network. Compose multi-step AI workplans that mix local Ollama with frontier APIs. Supports shell commands, local inference, and AI coding agents (Codex, Claude Code, Aider) — both **batch** (one-shot) and **interactive** (multi-turn PTY/stdin sessions mediated through the control plane with no direct client-to-node connection).

Workplane is a control plane + polling node runtime backed by Postgres. You submit tasks from a CLI; nodes pull work, run it in isolated workspaces, and stream logs and artifacts back.

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
export WORKPLANE_OPERATOR_TOKEN=your-operator-secret

workplane task submit shell --command "echo hello"
workplane tasks
workplane runs
workplane logs <runId>
```

## Authentication

| Variable | Used by |
|----------|---------|
| `WORKPLANE_NODE_TOKEN` | `workplane-node` (register, poll, report) |
| `WORKPLANE_OPERATOR_TOKEN` | `workplane` CLI (task submit / retry / cancel / send input) |

Read-only CLI commands (`tasks`, `logs`, `runs`, …) work without the operator token.

## CLI examples

```bash
export WORKPLANE_OPERATOR_TOKEN=...

# Shell
workplane task submit shell --command "npm test" \
  --repo https://github.com/you/your-repo.git

# Local inference (node must advertise ollama capability)
workplane task submit inference --model llama3.2 --prompt "Say hello"

# Batch harness (one-shot)
workplane task submit harness --harness claude-code \
  --repo git@github.com:you/app.git --prompt "Refactor auth middleware" \
  --requires claude-code,git

# Interactive harness (multi-turn PTY/stdin session)
workplane task submit harness --harness claude-code \
  --repo git@github.com:you/app.git --prompt "Start exploring the codebase" \
  --interactive --requires claude-code,git

# Send input to a running interactive session
workplane run input <runId> --stdin "Focus on the auth module"
workplane run input <runId> --signal SIGINT
workplane run input <runId> --resize 220x50

# Skills (v0.3.0)
workplane skill list
workplane skill run code-review --repo . --model claude-haiku-4-5-20251001

# Inspect
workplane tasks [--status running]
workplane runs --task-id <taskId>
workplane run show <runId>
workplane logs <runId>
workplane artifacts <runId>
workplane task cancel <taskId>
workplane task retry <taskId>
```

## Node capabilities

Register capabilities when starting a node:

```bash
export WORKPLANE_NODE_CAPABILITIES=shell,git,ollama,aider,codex,claude-code
workplane-node
```

Tasks declare `requires`; the control plane assigns work to a node whose capabilities are a superset.

| Adapter | Capability tags | Modes |
|---------|----------------|-------|
| Shell | `shell` | batch |
| Ollama | `ollama` | batch |
| Aider | `aider`, `git` | batch |
| Codex | `codex`, `git` | batch, interactive (stdio) |
| Claude Code | `claude-code`, `git` | batch, interactive (PTY) |

Override harness binaries: `WORKPLANE_CODEX_BIN`, `WORKPLANE_CLAUDE_CODE_BIN`.

## Workplans (v0.3.0)

Compose multi-step AI pipelines with the `@workplane/workplans` DSL:

```ts
import { SequentialWorkplanRunner, LocalWorkplanContext } from "@workplane/workplans";

const plan = {
  id: "review", name: "Code Review",
  steps: [
    {
      id: "diff", adapter: "shell", provider: "shell",
      payload: { command: "git diff HEAD~1", cwd: "./my-repo" },
      output: { dest: "next" },
    },
    {
      id: "summarize", adapter: "ollama", provider: "ollama", model: "llama3",
      payload: { prompt: "Summarize these changes:\n{{prevOutput}}" },
      output: { dest: "next" },
    },
    {
      id: "critique", adapter: "anthropic", provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      payload: { prompt: "Review for correctness and security:\n{{prevOutput}}" },
    },
  ],
};

await new SequentialWorkplanRunner().run(plan, new LocalWorkplanContext());
```

Inline providers (`anthropic`, `openai`, `ollama`, `shell`, `file`) run without dispatching to a fleet node.

## Agent skills (v0.3.0)

Pre-built workplans via `@workplane/agent-skills`:

```ts
import { createDefaultRegistry } from "@workplane/agent-skills";
import { SequentialWorkplanRunner, LocalWorkplanContext } from "@workplane/workplans";

const skill = createDefaultRegistry().get("code-review");
const plan = skill.buildPlan({ repo: ".", model: "claude-haiku-4-5-20251001" });
await new SequentialWorkplanRunner().run(plan, new LocalWorkplanContext());
```

Or via CLI: `workplane skill run code-review --repo . --model claude-haiku-4-5-20251001`

## Library packages

All packages are published under `@workplane/` and can be imported independently:

| Package | Purpose |
|---------|---------|
| `@workplane/workplans` | Workplan DSL, sequential runner, inline providers |
| `@workplane/agent-skills` | Pre-built skills, SkillRegistry, CanonicalSkillWorkflow |
| `@workplane/adapter-sdk` | Build custom adapters — WorkAdapter, WorkContext, cancellable exec |
| `@workplane/types` | Shared TypeScript types |
| `@workplane/core` | Config, HTTP client, auth, git utilities |
| `@workplane/adapter-shell` | Shell command adapter |
| `@workplane/adapter-ollama` | Ollama inference adapter |
| `@workplane/adapter-aider` | Aider coding agent adapter |
| `@workplane/adapter-harness` | Base harness adapter (extended by codex/claude-code) |
| `@workplane/adapter-claude-code` | Claude Code adapter (PTY interactive) |
| `@workplane/adapter-codex` | Codex adapter (stdio interactive) |
| `@workplane/dbos` | Optional DBOS durability layer (step checkpointing + replay) |

## DBOS (optional)

DBOS durability is opt-in. The server boots without it by default:

```bash
# Default — no DBOS
workplane-server

# With DBOS durability
WORKPLANE_USE_DBOS=true workplane-server
```

## Personal fleet (home + office)

Run the control plane on an always-on host (VPS, NAS, or home server). Run nodes on each machine where tools or GPUs live. Nodes poll outbound — no inbound ports required. Use Tailscale, WireGuard, or a trusted LAN.

Set `WORKPLANE_SERVER_URL` to the control plane's reachable address on every node and CLI client.

Full deployment guide: [docs/deployment/FLEET.md](https://github.com/MindStaq/workplane/blob/main/docs/deployment/FLEET.md)

## Documentation

- [v0.3.0 specification](https://github.com/MindStaq/workplane/blob/main/docs/specs/v0.3.0/WORKPLANE_SPEC.md)
- [Source repository](https://github.com/MindStaq/workplane)
- [Issues](https://github.com/MindStaq/workplane/issues)

## License

MIT
