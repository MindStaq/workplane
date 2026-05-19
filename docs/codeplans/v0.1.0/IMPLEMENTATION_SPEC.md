# Workplane v0.1.0 Implementation Plan

**Version:** 0.1.0  
**Product spec:** [specs/v0.1.0/WORKPLANE_SPEC.md](../../specs/v0.1.0/WORKPLANE_SPEC.md)  
**Supersedes:** [LOCAL_FIRST_IMPLEMENTATION_SPEC.md](../../archive/codeplans/LOCAL_FIRST_IMPLEMENTATION_SPEC.md)

---

## 1. Purpose

Implement the **personal fleet** execution plane: route shell, **local inference**, and **batch harness** work to nodes on your private network (home, office, Tailscale).

Single-machine localhost development is a **subset**, not the definition of done.

---

## 2. Success criteria (v0.1.0)

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Control plane + Postgres + DBOS on a reachable host | DONE (localhost) |
| 2 | Node(s) register and poll with **authentication** | TODO |
| 3 | **Two physical/topology nodes** (e.g. office + home) execute tasks over private network | TODO |
| 4 | Shell task full lifecycle | DONE (single node) |
| 5 | **Inference** task on node with `ollama` (or vLLM) | TODO |
| 6 | **Harness batch** task (Codex or Claude Code CLI) with logs + artifacts | TODO |
| 7 | Aider batch path with `changes.diff` (reference harness) | IN PROGRESS |
| 8 | Retry + inspect via CLI | DONE |
| 9 | Cancel updates DB; node stops child (best-effort) | PARTIAL |

**Explicitly deferred to v0.2.0:** interactive stdin/PTY, `run_input_events`, `workplane run input`.

---

## 3. Current baseline (from local scaffold)

Already implemented:

- Monorepo: `core`, `server`, `node`, `cli`, `adapter-sdk`, `adapter-shell`, `adapter-aider`, `db`, `types`
- Schema: `tasks`, `runs`, `nodes`, `run_logs`, `artifacts`
- DBOS workflows for task/run mutations
- REST API (tasks, runs, nodes, logs, artifacts)
- Polling node runtime + workspace layout
- Shell adapter + shared git checkout in node
- Aider adapter (minimal; no task branch / UAT)
- CLI submit/inspect/retry/cancel
- `pnpm uat:shell`

Gap vs v0.1.0 product spec: **multi-node auth**, **inference adapters**, **codex/claude-code harness adapters**, **fleet deployment docs**.

---

## 4. Implementation phases

### Phase A — Fleet foundation (multi-machine)

**Goal:** Safe to run control plane on Tailscale/LAN with nodes in two sites.

- [ ] **A1** Enforce `WORKPLANE_NODE_TOKEN` on server for:
  - `POST /nodes/register`
  - `POST /nodes/:nodeId/poll`
  - `POST /runs/:runId/status`
  - `POST /runs/:runId/logs`
  - `POST /runs/:runId/artifacts`
- [ ] **A2** Node sends `Authorization: Bearer $WORKPLANE_NODE_TOKEN`
- [ ] **A3** Document deployment: control plane URL, Postgres, firewall, example Tailscale hostnames
- [ ] **A4** Optional: `WORKPLANE_OPERATOR_TOKEN` for CLI task submission
- [ ] **A5** E2E checklist: laptop submits task → office node executes (shell `echo` sufficient)

Exit: office node polls home-hosted API with token; shell task completes.

### Phase B — Complete reference harness (Aider)

**Goal:** One full git-based agent path before Codex/Claude Code.

- [ ] **B1** Create task branch after clone (`workplane/<runId>`)
- [ ] **B2** Non-interactive aider flags (`--yes` or equivalent)
- [ ] **B3** Optional `testCommand` in payload + CLI
- [ ] **B4** `pnpm uat:aider`
- [ ] **B5** Cancel: node checks cancelled run / kills child

Exit: `workplane task submit aider` produces logs + `changes.diff` on a real repo.

### Phase C — Inference adapter (local models)

**Goal:** Route inference to the node that has the runtime.

- [ ] **C1** `packages/adapter-ollama` (or `adapter-inference` with `ollama` backend)
- [ ] **C2** Task kind `inference.batch`; validation schema
- [ ] **C3** Payload: `model`, `prompt` or `inputFile`, output artifact path
- [ ] **C4** CLI: `task submit inference --adapter ollama --requires ollama …`
- [ ] **C5** Capability docs: home vs office node env examples
- [ ] **C6** `pnpm uat:inference` (skip if no ollama in CI)

Exit: batch prompt runs on node advertising `ollama`; artifact or log contains model output.

Optional: **C7** vLLM adapter for office GPU node.

### Phase D — Harness batch adapters (Codex, Claude Code)

**Goal:** Invoke installed CLIs on the right machine without SSH.

- [ ] **D1** Shared `adapter-harness` base: clone, branch, exec CLI, capture diff/logs
- [ ] **D2** `packages/adapter-codex` — config: binary name, default args for non-interactive
- [ ] **D3** `packages/adapter-claude-code` — batch mode only (no PTY)
- [ ] **D4** CLI: `task submit harness --harness codex|claude-code …`
- [ ] **D5** Register adapters in node runtime `adapters` map
- [ ] **D6** Document required capabilities and env vars per harness
- [ ] **D7** Manual UAT on machine with real CLI installed

Exit: prompt run on office Mac with `claude-code` capability completes with logs + diff artifact.

**Note:** Interactive/session mode is **not** Phase D; see v0.2.0 spec.

### Phase E — Hardening and operator UX

- [ ] **E1** Stable node identity (reuse `node_id` by name or config UUID)
- [ ] **E2** Env allowlist in server → forwarded to `context.exec`
- [ ] **E3** Unit tests: capability matcher, validation, status transitions
- [ ] **E4** Integration test: API + poll assignment (test DB)
- [ ] **E5** `pnpm dev:db` (docker compose Postgres)
- [ ] **E6** README aligned with v0.1.0 fleet story

---

## 5. Suggested priority order

```text
A (auth + two-node shell)  →  B (aider UAT)  →  C (ollama)  →  D (codex/claude-code batch)  →  E
```

If office machine is priority: **A → D → C → B** (harness on office first, inference second).

---

## 6. Repository layout (target)

```text
packages/
  adapter-shell/          # exists
  adapter-aider/          # exists
  adapter-ollama/         # Phase C
  adapter-codex/          # Phase D
  adapter-claude-code/    # Phase D (batch)
  adapter-harness/        # optional shared lib Phase D
```

---

## 7. Configuration example (two-node fleet)

**Control plane host (home NAS, Tailscale IP 100.x.x.1):**

```bash
DATABASE_URL=postgres://…@localhost:5432/workplane
WORKPLANE_SERVER_PORT=8787
WORKPLANE_NODE_TOKEN=<shared-secret>
```

**Office node:**

```bash
WORKPLANE_SERVER_URL=http://100.x.x.1:8787
WORKPLANE_NODE_TOKEN=<shared-secret>
WORKPLANE_NODE_NAME=office-linux-gpu
WORKPLANE_NODE_CAPABILITIES=shell,git,gpu,vllm,codex
```

**Home node:**

```bash
WORKPLANE_SERVER_URL=http://100.x.x.1:8787
WORKPLANE_NODE_TOKEN=<shared-secret>
WORKPLANE_NODE_NAME=home-mac
WORKPLANE_NODE_CAPABILITIES=shell,git,ollama,claude-code,node
```

**Laptop (CLI only):**

```bash
WORKPLANE_SERVER_URL=http://100.x.x.1:8787
```

---

## 8. Testing strategy

| Layer | Target |
|-------|--------|
| Unit | capabilities, zod schemas, status guards |
| Integration | poll + assign + token rejection |
| E2E | `uat:shell`, `uat:aider`, `uat:inference`, manual harness UAT |
| Fleet | scripted checklist in docs (two Tailscale nodes) |

---

## 9. Definition of done

Matches [product spec §14](../../specs/v0.1.0/WORKPLANE_SPEC.md#14-definition-of-done-v010).

---

## 10. v0.2.0 handoff

When v0.1.0 is done, open `docs/codeplans/v0.2.0/IMPLEMENTATION_SPEC.md` for:

- `run_input_events` migration
- input API + node stdin/PTY loop
- interactive flag on harness adapters
- `workplane run input`

Product spec: [specs/v0.2.0/WORKPLANE_SPEC.md](../../specs/v0.2.0/WORKPLANE_SPEC.md).
