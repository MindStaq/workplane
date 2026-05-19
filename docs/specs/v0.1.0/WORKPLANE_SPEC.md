# Workplane v0.1.0 Specification

**Version:** 0.1.0  
**Status:** Current target  
**Supersedes:** [WORKPLANE_SPEC-v0.0-original.md](../../archive/specs/WORKPLANE_SPEC-v0.0-original.md)

---

## 1. Summary

**Workplane** is a TypeScript-first durable execution plane for routing work to **your own machines** across a **trusted private network** (Tailscale, Headscale, WireGuard, or LAN).

v0.1.0 exists so you can:

- run **local inference** workloads on the machine that has the GPU or model runtime (office workstation, home server, Mac mini, etc.)
- invoke **agent harness CLIs** (Codex, Claude Code, Aider, and similar) on the node where that tool is installed and credentialed
- submit work from one place (laptop, always-on control plane host) and have it execute on another node without SSH session management

Persistence uses **DBOS TypeScript** and **Postgres**. Execution semantics live in **adapters**; the core only routes, tracks, and records.

**v0.1.0 proof statement:**

> Submit a durable task from any authorized client, route it to a capable node on your personal fleet, execute it through an adapter (shell, inference, or batch harness), capture logs and artifacts, and report final status—with node authentication enabled for multi-machine use.

**Not in v0.1.0:** interactive, long-running AI client sessions (PTY, follow-up prompts over the control plane). That is **[v0.2.0](../v0.2.0/WORKPLANE_SPEC.md)**.

---

## 2. Primary user story

You have machines in **multiple physical locations** (e.g. home and office). Some run local models (Ollama, vLLM, exo); others have Codex or Claude Code installed with the right API keys. You want one control plane and one CLI habit:

```bash
# Run an eval on the office GPU box
workplane task submit inference \
  --adapter ollama \
  --requires gpu,ollama \
  --model llama3 \
  --input ./prompts/batch.jsonl

# Run Codex on the machine where it is configured
workplane task submit harness \
  --harness codex \
  --requires codex,git \
  --repo git@github.com:you/project.git \
  --prompt "Fix the failing tests in billing"
```

Workplane selects a node whose **capabilities** satisfy the task, creates a workspace, runs the adapter, and returns logs and artifacts.

---

## 3. Positioning

### 3.1 What Workplane is

- A **personal fleet** orchestrator (not multi-tenant SaaS)
- A **DBOS-backed** durable task and run store
- A **capability-based** router (`gpu`, `ollama`, `codex`, `claude-code`, `shell`, `git`, …)
- An **adapter** framework for shell, inference, and harness-batch execution
- **Private-network-first**: nodes poll outbound; no inbound ports required on workers

### 3.2 What Workplane is not (v0.1.0)

- A hosted model API or model router (you bring Ollama/vLLM on nodes)
- A replacement for Claude Code, Codex, or Aider (it invokes them)
- An interactive terminal multiplexer (v0.2.0)
- Kubernetes, Temporal, or CI/CD as a product
- Multi-user RBAC or public internet exposure without additional hardening

---

## 4. Version roadmap

| Version | Focus |
|---------|--------|
| **v0.1.0** | Personal multi-node fleet; node auth; shell + **inference** + **batch harness** adapters; logs/artifacts/retry |
| **v0.2.0** | **Interactive AI client** workloads (Claude Code, Codex sessions, PTY, stdin via control plane) |
| **v0.3.0+** | GitHub PR flow, secrets managers, Docker sandboxing, scheduling (TBD) |

---

## 5. Goals for v0.1.0

### 5.1 Primary goals

1. TypeScript control plane with Postgres + DBOS
2. **Multi-machine deployment** on a trusted private network (not single-host-only)
3. **Node authentication** via static shared token (`WORKPLANE_NODE_TOKEN`)
4. Node registration, heartbeat (via poll), capability-based routing
5. Task submit, run tracking, retry, cancel (DB-level; process kill best-effort)
6. Per-run workspace, log capture, artifact capture
7. **Shell adapter** (`shell.exec`)
8. **Inference adapter family** — at least one of: Ollama, vLLM, or a thin generic `inference.exec` wrapper
9. **Harness-batch adapter family** — invoke installed CLIs non-interactively:
   - **Codex** (or `codex` capability)
   - **Claude Code** (`claude-code` capability) — batch/one-shot mode, not full interactive session
   - **Aider** (retain as reference agent adapter)
10. Git clone + optional branch checkout in workspace
11. CLI: submit, list, show, logs, artifacts, retry, cancel; node and server start helpers
12. Capability tags on nodes so office vs home machines receive appropriate work

### 5.2 Secondary goals (if feasible in v0.1.0)

- Diff artifact for repo-changing harness runs
- Optional post-run test command
- Env allowlist for secrets (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, …)
- `pnpm uat:*` smoke tests for shell, inference, and one harness path
- Stable node identity (re-register same logical node name)

### 5.3 Non-goals for v0.1.0

- Interactive PTY / stdin routing through control plane → **v0.2.0**
- Full “AI client session” UX (multi-turn chat while process stays open) → **v0.2.0**
- OpenHands, plugin marketplace, webhooks, scheduled jobs
- Multi-tenant RBAC, OIDC, mTLS (mTLS may land in v0.2.0+)
- GitHub App / PR automation
- Mandatory Docker isolation
- Distributed inference across nodes (single-node inference only; routing picks **which** node)

---

## 6. Deployment topology (v0.1.0)

Typical personal fleet:

```text
                    Tailscale / WireGuard / LAN
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌─────────────────┐         ┌──────────────────────────┐  │
│  │ Control plane   │◄────────│ Your laptop (CLI)        │  │
│  │ Postgres+Server │  HTTPS  │ workplane task submit …  │  │
│  │ (home NAS or    │         └──────────────────────────┘  │
│  │  always-on VM)  │                                         │
│  └────────▲────────┘                                         │
│           │ poll + token                                     │
│     ┌─────┴─────┬─────────────┐                              │
│     │           │             │                              │
│  ┌──▼──┐    ┌───▼───┐    ┌────▼────┐                         │
│  │Node │    │ Node  │    │ Node    │                         │
│  │home │    │office │    │office   │                         │
│  │ollama│   │codex  │    │gpu+vllm │                         │
│  └─────┘    └───────┘    └─────────┘                         │
└──────────────────────────────────────────────────────────────┘
```

Requirements:

- Control plane URL reachable by all nodes and your CLI (e.g. `https://workplane.tailnet-name.ts.net:8787` or LAN IP).
- Postgres co-located with server or reachable privately.
- Each node: `WORKPLANE_SERVER_URL`, `WORKPLANE_NODE_TOKEN`, capability list reflecting installed tools.

---

## 7. Security model (v0.1.0)

### 7.1 Trust boundary

- Private network between control plane, nodes, and operators.
- Control plane **must not** be exposed to the public internet without a reverse proxy and stronger auth than v0.1.0 provides.

### 7.2 Node authentication (required for v0.1.0)

Static bearer token shared per deployment (rotate manually):

```bash
WORKPLANE_NODE_TOKEN=<long-random-secret>
```

- Server: reject node routes without valid `Authorization: Bearer <token>` when token is configured.
- Node: send token on register, poll, status, logs, artifacts.

Operator CLI may use the same token or a separate `WORKPLANE_OPERATOR_TOKEN` (optional v0.1.0 enhancement).

### 7.3 Task secrets

- No secrets in task JSON payloads.
- Pass via node environment; optional **env allowlist** in server config for which keys adapters may forward to child processes.

### 7.4 Workspace isolation

- One directory per run under `WORKPLANE_WORKSPACE_ROOT`.
- No default mount of `$HOME`; explicit repo clone into `repo/`.

Detailed security notes and future mTLS/OIDC: see archived spec §18 (reference only).

---

## 8. Core vocabulary

| Term | Meaning |
|------|---------|
| **Node** | A machine (or process) that polls for work and runs adapters |
| **Task** | A requested unit of work with `kind`, `adapter`, `payload`, `requires` |
| **Run** | One execution attempt for a task on a specific node |
| **Adapter** | Executes a class of work on a node |
| **Capability** | Advertised skill on a node (`ollama`, `codex`, `gpu`, …) |
| **Harness** | External agent CLI (Codex, Claude Code, Aider) invoked by a harness adapter |
| **Control plane** | HTTP API + Postgres + DBOS |

---

## 9. Adapter families (v0.1.0)

### 9.1 Shell (`shell`)

```json
{
  "kind": "shell.exec",
  "adapter": "shell",
  "requires": ["shell"],
  "payload": { "command": "npm test", "repo": "…", "cwd": "repo" }
}
```

### 9.2 Inference (`inference`)

Local model execution on the chosen node.

```json
{
  "kind": "inference.batch",
  "adapter": "ollama",
  "requires": ["ollama"],
  "payload": {
    "model": "llama3",
    "prompt": "…",
    "inputFile": "evals/prompts.jsonl",
    "outputArtifact": "results.jsonl"
  }
}
```

Adapters (minimum one for v0.1.0 done):

| Adapter | Capability | Notes |
|---------|------------|--------|
| `ollama` | `ollama` | `ollama run` / API wrapper |
| `vllm` | `vllm`, `gpu` | optional; office GPU |
| `inference` | `inference` | generic fallback CLI |

### 9.3 Harness batch (`harness`)

Non-interactive invocation of installed agent CLIs.

```json
{
  "kind": "agent.run",
  "adapter": "codex",
  "requires": ["codex", "git"],
  "payload": {
    "repo": "git@github.com:org/app.git",
    "prompt": "Fix failing tests",
    "branch": "main"
  }
}
```

| Adapter | Capability | v0.1.0 mode |
|---------|------------|-------------|
| `codex` | `codex` | One-shot / non-interactive flags |
| `claude-code` | `claude-code` | Batch CLI invocation, not PTY session |
| `aider` | `aider`, `git` | Existing path; diff artifact |

Harness adapters share: clone → optional branch → run CLI → capture logs → diff or output artifacts.

**Interactive harness behavior** (user types while process runs) is explicitly **v0.2.0**.

---

## 10. Capability model

Nodes declare capabilities at registration (updated each poll):

```text
# Home Mac
shell,git,node,ollama

# Office Linux + GPU
shell,git,gpu,vllm,codex

# Office Mac with Claude Code
shell,git,claude-code,node,typescript
```

Tasks declare `requires`; scheduler assigns to online nodes where `requires ⊆ node.capabilities`.

Optional location hints (future): `requires: ["gpu", "site:office"]` — not required for v0.1.0 if capabilities alone suffice.

---

## 11. Task lifecycle

Unchanged from v0.0 reference: `queued` → `assigned` → `running` → `succeeded` | `failed` | `cancelled`; retry re-queues failed tasks.

See [archive spec §10](../../archive/specs/WORKPLANE_SPEC-v0.0-original.md) for diagrams.

---

## 12. API and CLI

v0.1.0 implements the REST surface described in the archived spec (§17), with these **additions/changes**:

| Change | Notes |
|--------|--------|
| Node routes require bearer token when configured | See §7.2 |
| Task types | `inference.*`, harness adapters `codex`, `claude-code`, `aider` |
| No `POST /runs/:runId/input` | Deferred to v0.2.0 |

CLI additions (target):

```bash
workplane task submit inference --adapter ollama --requires ollama --model … 
workplane task submit harness --harness codex --repo … --prompt …
```

Full command list: [archive spec §16](../../archive/specs/WORKPLANE_SPEC-v0.0-original.md).

---

## 13. Data model

Same tables as implemented today: `tasks`, `runs`, `nodes`, `run_logs`, `artifacts`.

`run_input_events` and durable `steps` table: **v0.2.0** (interactive clients).

---

## 14. Definition of done (v0.1.0)

v0.1.0 is complete when, on a **real two-node** setup (e.g. home + office over Tailscale):

1. Control plane runs with auth enabled.
2. Each node registers with distinct capabilities and polls successfully.
3. A **shell** task runs on a chosen node.
4. An **inference** task runs on the node with `ollama` (or vLLM).
5. A **harness** task (Codex or Claude Code batch) runs on the node with that CLI installed.
6. Logs and artifacts are visible from the CLI; retry preserves history.

Single-machine development remains supported as a degenerate case (one node, localhost).

---

## 15. Implementation reference

Execution plan and phase checklist: [codeplans/v0.1.0/IMPLEMENTATION_SPEC.md](../../codeplans/v0.1.0/IMPLEMENTATION_SPEC.md).

Current codebase status: local single-node scaffold complete; multi-node auth, inference, and harness adapters in progress.

---

## 16. Appendix

Detailed sections preserved in the archived monolith (adapter interface sketches, DBOS examples, package layout, user stories):

- [WORKPLANE_SPEC-v0.0-original.md](../../archive/specs/WORKPLANE_SPEC-v0.0-original.md)

When appendix content conflicts with this document, **this v0.1.0 spec prevails**.
