# Workplane

[![CI](https://github.com/MindStaq/workplane/actions/workflows/ci.yml/badge.svg)](https://github.com/MindStaq/workplane/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/workplane)](https://www.npmjs.com/package/workplane)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange)](https://github.com/MindStaq/workplane)
[![Not production ready](https://img.shields.io/badge/production--ready-no-red)](https://github.com/MindStaq/workplane)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

> **Alpha software.** APIs and data models are unstable and will change between releases. Not recommended for production use.

**Specs:** [docs/specs/v0.2.0/WORKPLANE_SPEC.md](docs/specs/v0.2.0/WORKPLANE_SPEC.md) · **UAT scenarios:** [docs/UAT_SCENARIOS.md](docs/UAT_SCENARIOS.md) · **Fleet deploy:** [docs/deployment/FLEET.md](docs/deployment/FLEET.md)

Route durable work to capable nodes on your private network. Supports shell commands, local inference (Ollama), and AI coding agents (Codex, Claude Code, Aider) — both **batch** (one-shot) and **interactive** (multi-turn PTY/stdin sessions driven through the control plane with no direct client-to-node connection).

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

Run tests and UAT scripts:

```bash
pnpm test             # unit tests (22 passing)
pnpm uat:shell        # end-to-end shell task (starts server + node)
pnpm uat:aider        # end-to-end aider task (requires aider on PATH + UAT_REPO)
pnpm uat:interactive  # end-to-end interactive claude-code/codex (requires binary + UAT_REPO)
pnpm test:auth        # auth integration test
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
pnpm dev:cli -- task submit shell --command "echo hello"
pnpm dev:cli -- task submit shell --repo <git-url> --command "pnpm test" --requires shell,git

# Inference
pnpm dev:cli -- task submit inference --model llama3.2 --prompt "Summarise this"

# Batch harness (one-shot, no interaction)
pnpm dev:cli -- task submit harness --harness claude-code \
  --repo <git-url> --prompt "Refactor auth middleware" --requires claude-code,git

pnpm dev:cli -- task submit harness --harness codex \
  --repo <git-url> --prompt "Fix all TypeScript errors" --test-command "pnpm tsc --noEmit"

# Interactive harness (multi-turn PTY/stdin session)
pnpm dev:cli -- task submit harness --harness claude-code \
  --repo <git-url> --prompt "Start exploring the codebase" --interactive --requires claude-code,git

# Send input to a running interactive session
pnpm dev:cli -- run input <runId> --stdin "Focus on the auth module"
pnpm dev:cli -- run input <runId> --signal SIGINT
pnpm dev:cli -- run input <runId> --resize 220x50

# Inspect
pnpm dev:cli -- tasks [--status running]
pnpm dev:cli -- runs --task-id <taskId>
pnpm dev:cli -- run show <runId>
pnpm dev:cli -- logs <runId>
pnpm dev:cli -- artifacts <runId>
pnpm dev:cli -- task cancel <taskId>
pnpm dev:cli -- task retry <taskId>
```

See [docs/UAT_SCENARIOS.md](docs/UAT_SCENARIOS.md) for complete worked examples.

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

v0.2.0 adds control-plane–mediated stdin/PTY routing. When `--interactive` is set:

- The node spawns the agent with a real PTY (claude-code) or stdin pipe (codex)
- The control plane persists input events in `run_input_events` with sequence numbers
- The node polls for events every 500ms and writes them to the process
- All output streams back through run logs — no direct client-to-node connection needed
- SIGTERM escalates to SIGKILL after 5 seconds on both PTY and stdio processes

## Personal fleet (office + home)

Control plane on one always-reachable host; nodes poll outbound with `WORKPLANE_NODE_TOKEN`. No inbound ports required on nodes. Use Tailscale, WireGuard, or a trusted LAN.

Full deployment checklist: [docs/deployment/FLEET.md](docs/deployment/FLEET.md).

## Progress

| Version | Status | Progress |
|---------|--------|----------|
| v0.1.0 | Stable | [IMPLEMENTATION_PROGRESS.md](docs/codeplans/v0.1.0/IMPLEMENTATION_PROGRESS.md) |
| v0.2.0 | Complete | [IMPLEMENTATION_PROGRESS.md](docs/codeplans/v0.2.0/IMPLEMENTATION_PROGRESS.md) |
| v0.3.0 | Planned | [IMPLEMENTATION_SPEC.md](docs/codeplans/v0.3.0/IMPLEMENTATION_SPEC.md) |

## DBOS Conductor (optional)

```bash
export DBOS_APPLICATION_NAME=workplane-dev
export DBOS_CONDUCTOR_KEY=<key>
pnpm dev:server
```
