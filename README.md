# Workplane

[![CI](https://github.com/MindStaq/workplane/actions/workflows/ci.yml/badge.svg)](https://github.com/MindStaq/workplane/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/workplane)](https://www.npmjs.com/package/workplane)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange)](https://github.com/MindStaq/workplane)
[![Not production ready](https://img.shields.io/badge/production--ready-no-red)](https://github.com/MindStaq/workplane)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

> **Alpha software.** APIs and data models are unstable and will change between releases. Not recommended for production use.

Route durable work to capable nodes on your private network. Compose multi-step AI workplans that mix local Ollama with frontier APIs. Supports shell commands, local inference, and AI coding agents (Codex, Claude Code, Aider) — both **batch** (one-shot) and **interactive** (multi-turn PTY/stdin sessions driven through the control plane with no direct client-to-node connection).

**Spec:** [docs/specs/v0.3.0/WORKPLANE_SPEC.md](docs/specs/v0.3.0/WORKPLANE_SPEC.md) · **Fleet deploy:** [docs/deployment/FLEET.md](docs/deployment/FLEET.md) · **Roadmap:** [docs/roadmap.md](docs/roadmap.md)

## Install

```bash
npm install -g workplane
workplane-setup   # interactive first-run wizard; press Enter to accept defaults
```

`workplane-setup` generates auth tokens, configures the database (`~/.workplane/workplane.db` by default — no Postgres required for a single machine), and runs migrations. Re-run it at any time to reconfigure.

## Quick start — skills (no server needed)

Run built-in AI skills directly on your machine. No server, database, or configuration required.

```bash
export ANTHROPIC_API_KEY=...

workplane skill list
workplane skill run summarize-file --file ./README.md
workplane skill run code-review --repo . --model claude-haiku-4-5-20251001
```

## Quick start — fleet

```bash
workplane-setup       # first-time config + migrations

workplane-server      # terminal 1 — control plane
workplane-node        # terminal 2 — worker

# Submit work from a third terminal
workplane task submit shell --command "echo hello"
workplane tasks
workplane logs <runId>
```

The default database is SQLite at `~/.workplane/workplane.db`. To switch to Postgres, re-run `workplane-setup` and enter a `postgres://` URL when prompted.

## Authentication

`workplane-setup` generates tokens and writes them to `~/.workplane/.env`. To set them manually:

| Variable | Used by |
|----------|---------|
| `WORKPLANE_NODE_TOKEN` | `workplane-node` (must match the server's value) |
| `WORKPLANE_OPERATOR_TOKEN` | `workplane` CLI — task submit, retry, cancel, send input |

## CLI reference

```bash
export WORKPLANE_OPERATOR_TOKEN=...

# Shell
workplane task submit shell --command "npm test" \
  --repo <git-url> --requires shell,git

# Inference
workplane task submit inference --model llama3.2 --prompt "Summarise this"

# Batch harness (one-shot)
workplane task submit harness --harness claude-code \
  --repo <git-url> --prompt "Refactor auth middleware" --requires claude-code,git

# Interactive harness (multi-turn PTY/stdin session)
workplane task submit harness --harness claude-code \
  --repo <git-url> --prompt "Start exploring the codebase" \
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
workplane schedule delete <scheduleId>
workplane workplan-runs
workplane workplan-run show <runId>
```

## Workplan scheduling

v0.4.2 adds cron-based scheduling for multi-step workplans (skills). The server runs a background tick that enqueues due runs; each run executes through the same workplan runner used by `workplane skill run`.

```bash
workplane-server   # scheduler enabled by default

# Create a schedule for the built-in hello skill (shell echo smoke test)
workplane schedule create hello \
  --cron "0 9 * * *" \
  --timezone UTC \
  --input message=hello

workplane schedule list
workplane schedule run <scheduleId>   # trigger immediately
workplane workplan-runs
workplane workplan-run show <runId>
workplane workplan-run steps <runId>
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `WORKPLANE_SCHEDULER_ENABLED` | `true` | Set to `false` to disable the background scheduler |
| `WORKPLANE_SCHEDULER_INTERVAL_MS` | `60000` | How often the server checks for due schedules (ms) |

Cron uses six fields (seconds optional): `second minute hour day month weekday`. For sub-minute testing in development, use a six-field expression such as `*/20 * * * * *` and set `WORKPLANE_SCHEDULER_INTERVAL_MS=10000`.

**Note:** The server loads the skill registry at startup. After pulling new skills, restart `workplane-server`.

## Workplans

v0.3.0 introduces a workplan DSL for composing multi-step AI pipelines:

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

Built-in skills include `code-review`, `summarize-file`, and `hello` (shell echo — useful for scheduler smoke tests).

## Library packages

All packages are published under `@workplane/` and can be imported independently:

| Package | Purpose |
|---------|---------|
| `@workplane/workplans` | Workplan DSL, sequential runner, inline providers, ScheduleBuilder |
| `@workplane/agent-skills` | Pre-built skills, SkillRegistry, CanonicalSkillWorkflow interface |
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

## Adapters

| Adapter | Capability tags | Modes |
|---------|----------------|-------|
| `shell` | `shell` | batch |
| `ollama` | `ollama` | batch |
| `aider` | `aider`, `git` | batch |
| `codex` | `codex`, `git` | batch, interactive (stdio) |
| `claude-code` | `claude-code`, `git` | batch, interactive (PTY) |

Override harness binaries: `WORKPLANE_CODEX_BIN`, `WORKPLANE_CLAUDE_CODE_BIN`.

## Interactive mode

Control-plane–mediated PTY/stdin routing — no direct client-to-node connection:

- The node spawns the agent with a real PTY (claude-code) or stdin pipe (codex)
- The control plane persists input events with sequence numbers
- The node polls for new events every 500ms and writes them to the process
- All output streams back through run logs
- SIGTERM escalates to SIGKILL after 5 seconds

## Personal fleet (home + office)

Run the control plane on an always-on host (VPS, NAS, or home server). Run nodes on each machine where tools or GPUs live. Nodes poll outbound — no inbound ports required on workers. Use Tailscale, WireGuard, or a trusted LAN.

Run `workplane-setup` on each machine. Set `WORKPLANE_SERVER_URL` to the control plane's reachable address on worker machines. Copy the `WORKPLANE_NODE_TOKEN` from the server machine's `~/.workplane/.env`.

Full deployment guide: [docs/deployment/FLEET.md](docs/deployment/FLEET.md)

## DBOS (optional)

DBOS durability is opt-in. The server boots without it by default:

```bash
# Default — SQLite or Postgres; no DBOS
workplane-server

# With DBOS durability (Postgres required)
WORKPLANE_USE_DBOS=true workplane-server
```

## Progress

| Version | Status | Notes |
|---------|--------|-------|
| v0.1.0 | Complete | Fleet routing, shell/inference/harness adapters, CLI |
| v0.2.0 | Complete | Interactive PTY/stdin sessions over control plane |
| v0.3.0 | Complete | DBOS extraction, workplans, agent skills, library publish pipeline |
| v0.4.2 | Complete | Workplan scheduling (cron + CLI), hello skill, migration baseline fix |

---

## Development

Clone the repo and use pnpm:

```bash
pnpm install
cp .env.example .env.local
# edit DATABASE_URL and tokens in .env.local

pnpm dev:db          # optional: docker Postgres
pnpm db:migrate      # apply schema
pnpm dev:server      # terminal 1
pnpm dev:node        # terminal 2

# CLI against local server (no `--` separator needed with pnpm)
pnpm dev:cli schedule create hello --cron "*/20 * * * * *" --timezone UTC --input message=hello
pnpm dev:cli schedule list
pnpm dev:cli workplan-runs
```

Run tests:

```bash
pnpm test             # unit tests
pnpm uat:shell        # end-to-end shell task
pnpm uat:interactive  # end-to-end interactive harness (requires binary + UAT_REPO)
```

Build:

```bash
pnpm build:libs       # compile all @workplane/* library packages
pnpm build            # build the workplane distribution bundle
```

Generate new database migrations after schema changes:

```bash
pnpm db:generate      # regenerates both pg and sqlite migration files
```
