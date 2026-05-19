# Personal fleet deployment (v0.1.0)

Run the control plane on one always-reachable host (home NAS, small VM, or Mac mini). Run nodes wherever tools and GPUs live (office desktop, home machine).

## Network

Use Tailscale, Headscale, WireGuard, or a trusted LAN. Nodes only need **outbound** HTTPS to the control plane.

Example:

| Host | Tailscale IP | Role |
|------|----------------|------|
| `home-server` | `100.64.0.1` | Postgres + control plane |
| `office-gpu` | `100.64.0.2` | Node (`vllm`, `codex`) |
| `home-mac` | `100.64.0.3` | Node (`ollama`, `claude-code`) |
| laptop | — | CLI only |

Control plane URL for nodes and CLI:

```bash
WORKPLANE_SERVER_URL=http://100.64.0.1:8787
```

## Auth

Generate two secrets and distribute:

```bash
WORKPLANE_NODE_TOKEN=<long-random>
WORKPLANE_OPERATOR_TOKEN=<long-random>
```

| Component | Variables |
|-----------|-----------|
| Server | `DATABASE_URL`, `WORKPLANE_NODE_TOKEN`, `WORKPLANE_OPERATOR_TOKEN` |
| Node | `WORKPLANE_SERVER_URL`, `WORKPLANE_NODE_TOKEN`, `WORKPLANE_NODE_NAME`, `WORKPLANE_NODE_CAPABILITIES` |
| CLI | `WORKPLANE_SERVER_URL`, `WORKPLANE_OPERATOR_TOKEN` |

When tokens are unset, auth checks are disabled (localhost dev only).

## Capability examples

**Office GPU / Codex:**

```bash
WORKPLANE_NODE_NAME=office-gpu
WORKPLANE_NODE_CAPABILITIES=shell,git,gpu,codex
```

**Home Ollama / Claude Code:**

```bash
WORKPLANE_NODE_NAME=home-mac
WORKPLANE_NODE_CAPABILITIES=shell,git,ollama,claude-code,node
```

## Submit from laptop

```bash
export WORKPLANE_SERVER_URL=http://100.64.0.1:8787
export WORKPLANE_OPERATOR_TOKEN=...

pnpm dev:cli -- task submit inference --model llama3.2 --prompt "Hello" --requires ollama
pnpm dev:cli -- task submit harness --harness codex --repo git@github.com:you/app.git --prompt "Fix tests"
```

## Checklist (two-node proof)

1. [ ] Control plane healthy: `curl http://<cp>/healthz`
2. [ ] Each node logs `node registered: node_…` without 401
3. [ ] Shell task succeeds from CLI with operator token
4. [ ] Inference task runs only on node with `ollama`
5. [ ] Harness task runs only on node with `codex` or `claude-code`

## Local single-machine

Copy `.env.example` to `.env.local`, run `pnpm dev:db`, `pnpm db:migrate`, `pnpm dev:server`, `pnpm dev:node`, then `pnpm uat:shell`.

## npm install

See [NPM.md](./NPM.md) for global install (`npm install -g workplane`) and published binaries.
