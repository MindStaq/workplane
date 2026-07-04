# workplane

[![website](https://img.shields.io/badge/website-mindstaq.github.io%2Fworkplane-3dd6c6)](https://mindstaq.github.io/workplane/)
[![npm version](https://img.shields.io/npm/v/workplane)](https://www.npmjs.com/package/workplane)
[![status](https://img.shields.io/badge/status-alpha-orange)](https://github.com/MindStaq/workplane)
[![license](https://img.shields.io/npm/l/workplane)](https://github.com/MindStaq/workplane/blob/main/packages/workplane/LICENSE)

> **Alpha software.** APIs and data models are unstable and will change between releases. Not recommended for production use.

Route durable work to capable nodes on your private network. Compose multi-step AI workplans that mix local Ollama with frontier APIs. Supports shell commands, local inference, and AI coding agents (Codex, Claude Code, Aider) — both **batch** (one-shot) and **interactive** (multi-turn PTY/stdin sessions mediated through the control plane with no direct client-to-node connection).

**Requires Node.js 20+.**

## Install

```bash
npm install -g workplane
```

| Binary | Purpose |
|--------|---------|
| `workplane-setup` | First-run wizard — configure and migrate in one step |
| `workplane` | CLI — skills, workplans, fleet task submit/inspect |
| `workplane-server` | Control plane API |
| `workplane-node` | Worker that polls and executes tasks |
| `workplane-db-migrate` | Apply schema (called automatically by `workplane-setup`) |

## Quick start — skills (no server needed)

Run built-in AI skills directly on your machine. No server, no database, no configuration required.

```bash
export ANTHROPIC_API_KEY=...   # for frontier model steps
export OLLAMA_HOST=http://localhost:11434   # optional; shown is the default

workplane skill list
workplane skill run summarize-file --file ./README.md
workplane skill run code-review --repo . --model claude-haiku-4-5-20251001
```

## Quick start — fleet (single machine)

```bash
# 1. Run setup — interactive wizard, press Enter to accept smart defaults
workplane-setup

# 2. Start the control plane and a worker (two terminals)
workplane-server
workplane-node

# 3. Submit work (third terminal)
workplane task submit shell --command "echo hello"
workplane tasks
workplane logs <runId>
```

`workplane-setup` configures tokens, picks a database, and runs migrations. The default database is SQLite at `~/.workplane/workplane.db` — no Postgres required for a single-machine fleet. Run `workplane-setup` again at any time to reconfigure.

### Switching to Postgres

Re-run setup and enter a Postgres URL when prompted:

```bash
workplane-setup
# DATABASE_URL [sqlite://~/.workplane/workplane.db]: postgres://user:pass@host:5432/workplane
```

Postgres is recommended when running multiple server instances or when you need managed backups.

## Authentication

`workplane-setup` generates tokens automatically. To set them manually:

| Variable | Used by |
|----------|---------|
| `WORKPLANE_NODE_TOKEN` | `workplane-node` (must match the server's value) |
| `WORKPLANE_OPERATOR_TOKEN` | `workplane` CLI — task submit, retry, cancel |

Read-only commands (`tasks`, `logs`, `runs`, …) work without the operator token.

## CLI reference

```bash
export WORKPLANE_OPERATOR_TOKEN=...   # set once; stored in ~/.workplane/.env by setup

# Shell task
workplane task submit shell --command "npm test" \
  --repo https://github.com/you/repo.git --requires shell,git

# Local inference (node must advertise ollama capability)
workplane task submit inference --model llama3.2 --prompt "Summarise this"

# Batch agent (one-shot)
workplane task submit harness --harness claude-code \
  --repo git@github.com:you/app.git \
  --prompt "Refactor auth middleware" --requires claude-code,git

# Interactive agent (multi-turn PTY/stdin session)
workplane task submit harness --harness claude-code \
  --repo git@github.com:you/app.git \
  --prompt "Start exploring the codebase" \
  --interactive --requires claude-code,git

# Send input to a running interactive session
workplane run input <runId> --stdin "Focus on the auth module"
workplane run input <runId> --signal SIGINT
workplane run input <runId> --resize 220x50

# Skills
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

# Workplan scheduling (server required)
workplane schedule create hello --cron "0 9 * * *" --timezone UTC --input message=hello
workplane schedule list
workplane schedule disable <scheduleId>
workplane workplan-runs
workplane workplan-run show <runId>
```

## Workplan scheduling

Cron-based scheduling for skills and custom workplans (v0.4.2). The server runs a background tick that enqueues due runs.

```bash
workplane-server   # scheduler enabled by default

workplane schedule create hello \
  --cron "0 9 * * *" \
  --timezone UTC \
  --input message=hello

workplane schedule list
workplane workplan-runs
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `WORKPLANE_SCHEDULER_ENABLED` | `true` | Disable with `false` |
| `WORKPLANE_SCHEDULER_INTERVAL_MS` | `60000` | Tick interval (ms) |

Built-in skills: `code-review`, `summarize-file`, and `hello` (shell echo for scheduler smoke tests).

## Workplans

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

## Agent skills

Pre-built workplans via `@workplane/agent-skills`:

```ts
import { createDefaultRegistry } from "@workplane/agent-skills";
import { SequentialWorkplanRunner, LocalWorkplanContext } from "@workplane/workplans";

const skill = createDefaultRegistry().get("code-review");
const plan = skill.buildPlan({ repo: ".", model: "claude-haiku-4-5-20251001" });
await new SequentialWorkplanRunner().run(plan, new LocalWorkplanContext());
```

Or via CLI: `workplane skill run code-review --repo . --model claude-haiku-4-5-20251001`

## Node capabilities

Nodes advertise what they can run. Tasks declare what they need.

```bash
export WORKPLANE_NODE_CAPABILITIES=shell,git,ollama,aider,codex,claude-code
workplane-node
```

| Adapter | Capability tags | Modes |
|---------|----------------|-------|
| Shell | `shell` | batch |
| Ollama | `ollama` | batch |
| Aider | `aider`, `git` | batch |
| Codex | `codex`, `git` | batch, interactive (stdio) |
| Claude Code | `claude-code`, `git` | batch, interactive (PTY) |

Override harness binaries: `WORKPLANE_CODEX_BIN`, `WORKPLANE_CLAUDE_CODE_BIN`.

## Personal fleet (home + office)

Run the control plane on an always-on host (VPS, NAS, or home server). Run nodes on each machine where tools or GPUs live. Nodes poll outbound — no inbound ports required on workers. Use Tailscale, WireGuard, or a trusted LAN.

On each machine, run `workplane-setup` and set `WORKPLANE_SERVER_URL` to the control plane's reachable address.

Full deployment guide: [docs/deployment/FLEET.md](https://github.com/MindStaq/workplane/blob/main/docs/deployment/FLEET.md)

## Library packages

All packages are published under `@workplane/` and can be imported independently:

| Package | Purpose |
|---------|---------|
| `@workplane/workplans` | Workplan DSL, sequential runner, inline providers, ScheduleBuilder |
| `@workplane/agent-skills` | Pre-built skills, SkillRegistry, CanonicalSkillWorkflow |
| `@workplane/adapter-sdk` | Build custom adapters — WorkAdapter, WorkContext, cancellable exec |
| `@workplane/types` | Shared TypeScript types |
| `@workplane/core` | Config, HTTP client, auth, git utilities |
| `@workplane/adapter-shell` | Shell command adapter |
| `@workplane/adapter-ollama` | Ollama inference adapter |
| `@workplane/adapter-aider` | Aider coding agent adapter |
| `@workplane/adapter-harness` | Base harness adapter |
| `@workplane/adapter-claude-code` | Claude Code adapter (PTY interactive) |
| `@workplane/adapter-codex` | Codex adapter (stdio interactive) |
| `@workplane/dbos` | Optional DBOS durability layer (step checkpointing + replay) |

## Documentation

- [v0.3.0 specification](https://github.com/MindStaq/workplane/blob/main/docs/specs/v0.3.0/WORKPLANE_SPEC.md)
- [Source repository](https://github.com/MindStaq/workplane)
- [Issues](https://github.com/MindStaq/workplane/issues)

## License

MIT
