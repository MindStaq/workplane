# Workplane

[![CI](https://github.com/MindStaq/workplane/actions/workflows/ci.yml/badge.svg)](https://github.com/MindStaq/workplane/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/workplane)](https://www.npmjs.com/package/workplane)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange)](https://github.com/MindStaq/workplane)
[![Not production ready](https://img.shields.io/badge/production--ready-no-red)](https://github.com/MindStaq/workplane)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

> **Alpha software.** APIs and data models are unstable and will change between releases. Not recommended for production use.

**Spec:** [docs/specs/v0.3.0/WORKPLANE_SPEC.md](docs/specs/v0.3.0/WORKPLANE_SPEC.md) · **UAT scenarios:** [docs/UAT_SCENARIOS.md](docs/UAT_SCENARIOS.md) · **Fleet deploy:** [docs/deployment/FLEET.md](docs/deployment/FLEET.md)

Route durable work to capable nodes on your private network. Compose multi-step AI workplans that mix local Ollama with frontier APIs. Supports shell commands, local inference, and AI coding agents (Codex, Claude Code, Aider) — both **batch** (one-shot) and **interactive** (multi-turn PTY/stdin sessions driven through the control plane with no direct client-to-node connection).

## Quick start (local)

```bash
pnpm install
cp .env.example .env.local
# edit DATABASE_URL and tokens in .env.local

pnpm dev:db          # optional: docker Postgres
pnpm db:migrate
pnpm dev:server      # terminal 1
pnpm dev:node        # terminal 2
```

Run tests:

```bash
pnpm test             # unit tests (59/60 passing; 1 skipped: PTY requires real TTY)
pnpm uat:shell        # end-to-end shell task
pnpm uat:interactive  # end-to-end interactive claude-code/codex (requires binary + UAT_REPO)
```

Build library packages:

```bash
pnpm build:libs       # compiles all @workplane/* library packages to dist/
pnpm build            # builds the workplane distribution bundle (executables)
```

## Auth

| Variable | Used by |
|----------|---------|
| `WORKPLANE_NODE_TOKEN` | Node register / poll / status / logs / artifacts / input events |
| `WORKPLANE_OPERATOR_TOKEN` | CLI task submit / retry / cancel / send input |

UAT scripts default to `dev-node-token` / `dev-operator-token` when unset. See [.env.example](.env.example).

## CLI examples

```bash
export WORKPLANE_OPERATOR_TOKEN=...

# Shell
workplane task submit shell --command "echo hello"
workplane task submit shell --repo <git-url> --command "pnpm test" --requires shell,git

# Inference
workplane task submit inference --model llama3.2 --prompt "Summarise this"

# Batch harness (one-shot)
workplane task submit harness --harness claude-code \
  --repo <git-url> --prompt "Refactor auth middleware" --requires claude-code,git

# Interactive harness (multi-turn PTY/stdin session)
workplane task submit harness --harness claude-code \
  --repo <git-url> --prompt "Start exploring the codebase" --interactive --requires claude-code,git

# Send input to a running interactive session
workplane run input <runId> --stdin "Focus on the auth module"
workplane run input <runId> --signal SIGINT
workplane run input <runId> --resize 220x50

# Skills (v0.3.0)
workplane skill list
workplane skill run code-review --repo . --model claude-haiku-4-5-20251001
workplane skill run summarize-file --file ./README.md

# Inspect
workplane tasks [--status running]
workplane runs --task-id <taskId>
workplane run show <runId>
workplane logs <runId>
workplane artifacts <runId>
workplane task cancel <taskId>
workplane task retry <taskId>
```

## Workplans

v0.3.0 introduces a workplan DSL for composing multi-step AI pipelines:

```ts
import { SequentialWorkplanRunner, LocalWorkplanContext } from "@workplane/workplans";

const plan = {
  id: "review", name: "Code Review",
  steps: [
    {
      id: "diff", name: "Git Diff",
      adapter: "shell", provider: "shell",
      payload: { command: "git diff HEAD~1", cwd: "./my-repo" },
      output: { dest: "next" },
    },
    {
      id: "summarize", name: "Summarize",
      adapter: "ollama", provider: "ollama", model: "llama3",
      payload: { prompt: "Summarize these changes:\n{{prevOutput}}" },
      output: { dest: "next" },
    },
    {
      id: "critique", name: "Critique",
      adapter: "anthropic", provider: "anthropic", model: "claude-haiku-4-5-20251001",
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

## Library packages

All packages are published under `@workplane/` and can be imported independently:

| Package | Purpose |
|---------|---------|
| `@workplane/workplans` | Workplan DSL, sequential runner, inline providers, ScheduleBuilder |
| `@workplane/agent-skills` | Pre-built skills, SkillRegistry, CanonicalSkillWorkflow interface |
| `@workplane/dbos` | Optional DBOS durability layer (step checkpointing + replay) |
| `@workplane/adapter-sdk` | Build custom adapters — WorkAdapter, WorkContext, cancellable exec |
| `@workplane/types` | Shared TypeScript types |
| `@workplane/core` | Config, HTTP client, auth, git utilities |
| `@workplane/adapter-shell` | Shell command adapter |
| `@workplane/adapter-ollama` | Ollama inference adapter |
| `@workplane/adapter-aider` | Aider coding agent adapter |
| `@workplane/adapter-harness` | Base harness adapter (extended by codex/claude-code) |
| `@workplane/adapter-claude-code` | Claude Code adapter (PTY interactive) |
| `@workplane/adapter-codex` | Codex adapter (stdio interactive) |

## Adapters

| Adapter | Capability tag | Modes | Kind |
|---------|---------------|-------|------|
| `shell` | `shell` | batch | `shell.exec` |
| `ollama` | `ollama` | batch | `inference.batch` |
| `aider` | `aider`, `git` | batch | `agent.run` |
| `codex` | `codex`, `git` | batch, interactive (stdio) | `agent.run` |
| `claude-code` | `claude-code`, `git` | batch, interactive (PTY) | `agent.run` |

Override harness binaries: `WORKPLANE_CODEX_BIN`, `WORKPLANE_CLAUDE_CODE_BIN`.

## Interactive mode

Control-plane–mediated PTY/stdin routing — no direct client-to-node connection:

- The node spawns the agent with a real PTY (claude-code) or stdin pipe (codex)
- The control plane persists input events in `run_input_events` with sequence numbers
- The node polls for events every 500ms and writes them to the process
- All output streams back through run logs
- SIGTERM escalates to SIGKILL after 5 seconds on both PTY and stdio processes

## DBOS (optional)

DBOS durability is now opt-in. The server boots without it by default:

```bash
# Default — no DBOS, no system tables required
workplane-server

# With DBOS durability
WORKPLANE_USE_DBOS=true workplane-server
DBOS_APPLICATION_NAME=workplane-dev
DBOS_CONDUCTOR_KEY=<key>   # optional: DBOS Cloud
```

## Personal fleet (office + home)

Control plane on one always-reachable host; nodes poll outbound with `WORKPLANE_NODE_TOKEN`. No inbound ports required on nodes. Use Tailscale, WireGuard, or a trusted LAN.

Full deployment checklist: [docs/deployment/FLEET.md](docs/deployment/FLEET.md).

## Progress

| Version | Status | Notes |
|---------|--------|-------|
| v0.1.0 | Complete | Fleet routing, shell/inference/harness adapters, CLI |
| v0.2.0 | Complete | Interactive PTY/stdin sessions over control plane |
| v0.3.0 | Complete | DBOS extraction, workplans, agent skills, library publish pipeline |
