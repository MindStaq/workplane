# Workplane

**Specs:** [docs/specs/v0.1.0/WORKPLANE_SPEC.md](docs/specs/v0.1.0/WORKPLANE_SPEC.md) · **Fleet deploy:** [docs/deployment/FLEET.md](docs/deployment/FLEET.md) · **npm:** [docs/deployment/NPM.md](docs/deployment/NPM.md)

Route durable work—shell, **local inference** (Ollama), and **batch harness** jobs (Codex, Claude Code, Aider)—to capable nodes on your private network.

## Install (npm)

```bash
npm install -g workplane
```

Binaries: `workplane` (CLI), `workplane-server`, `workplane-node`, `workplane-db-migrate`.

## Quick start (local / from source)

```bash
pnpm install
cp .env.example .env.local
# edit DATABASE_URL and tokens in .env.local

pnpm dev:db          # optional: docker Postgres
pnpm db:migrate
pnpm dev:server      # terminal 1
pnpm dev:node        # terminal 2
```

UAT (starts server + node, runs shell task with auth):

```bash
pnpm uat:shell
pnpm test            # unit tests
pnpm test:auth       # auth integration test
```

## Auth (v0.1.0)

When set on the server, nodes and operators must authenticate:

| Variable | Used by |
|----------|---------|
| `WORKPLANE_NODE_TOKEN` | Node register/poll/status/logs/artifacts |
| `WORKPLANE_OPERATOR_TOKEN` | CLI task submit/retry/cancel |

UAT scripts default to `dev-node-token` / `dev-operator-token` if unset. See [.env.example](.env.example).

## CLI examples

```bash
export WORKPLANE_OPERATOR_TOKEN=...   # if configured on server

pnpm dev:cli -- task submit shell --command "echo hello"
pnpm dev:cli -- task submit inference --model llama3.2 --prompt "Hello"
pnpm dev:cli -- task submit harness --harness codex --repo <git-url> --prompt "Fix tests"
pnpm dev:cli -- task submit aider --repo <git-url> --prompt "..." [--test-command "npm test"]
pnpm dev:cli -- tasks
pnpm dev:cli -- logs <runId>
```

## Adapters

| Adapter | Capability | Kind |
|---------|------------|------|
| `shell` | `shell` | `shell.exec` |
| `ollama` | `ollama` | `inference.batch` |
| `aider` | `aider`, `git` | `agent.run` |
| `codex` | `codex`, `git` | `agent.run` |
| `claude-code` | `claude-code`, `git` | `agent.run` |

Override harness binaries: `WORKPLANE_CODEX_BIN`, `WORKPLANE_CLAUDE_CODE_BIN`.

## Personal fleet (office + home)

Control plane on one host; nodes poll with matching `WORKPLANE_NODE_TOKEN`. Full checklist: [docs/deployment/FLEET.md](docs/deployment/FLEET.md).

## Progress

[docs/codeplans/v0.1.0/IMPLEMENTATION_PROGRESS.md](docs/codeplans/v0.1.0/IMPLEMENTATION_PROGRESS.md)

## DBOS Conductor (optional)

```bash
export DBOS_APPLICATION_NAME=workplane-dev
export DBOS_CONDUCTOR_KEY=<key>
pnpm dev:server
```
