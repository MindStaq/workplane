# Workplane v0.2.0 Specification

**Version:** 0.2.0  
**Status:** Planned (depends on v0.1.0)  
**Builds on:** [v0.1.0](../v0.1.0/WORKPLANE_SPEC.md)

---

## 1. Summary

v0.2.0 turns Workplane from a **batch routing plane** into a **control-plane–mediated AI client runtime**.

v0.1.0 can *invoke* Codex or Claude Code in one-shot mode. v0.2.0 supports **long-running, interactive** agent clients: the process stays alive, the user sends follow-up input through Workplane (not SSH to the node), and stdout/stderr stream back through run logs.

**v0.2.0 proof statement:**

> Submit an interactive Claude Code (or Codex) task to a capable node, send stdin (or PTY input) through the control plane while the run is active, and read output from logs—without direct client-to-node connections.

---

## 2. Motivation

Agent harnesses are often **terminal-native** and **multi-turn**. Personal fleets still need:

- Private nodes (no inbound ports)
- Durable run state if a laptop sleeps
- One place to attach from home or office

v0.1.0 proves routing and batch execution; v0.2.0 proves **session-shaped** AI workloads.

---

## 3. Goals for v0.2.0

### 3.1 Primary goals

1. **`run_input_events`** persistence and sequencing
2. Control plane API:
   - `POST /runs/:runId/input`
   - `GET /runs/:runId/input?afterSequence=…`
   - Delivery acknowledgement (or `delivered_at` updates)
3. Adapter SDK extensions:
   - `interactive?: boolean`
   - `terminalMode?: "stdio" | "pty"`
4. Node runtime:
   - Poll pending input for active interactive runs
   - Write stdin to child process
   - **PTY mode** (`node-pty` or equivalent) for Claude Code–class CLIs
   - Terminal resize events
5. **First-class interactive adapters:**
   - `claude-code` (interactive)
   - `codex` (interactive, if supported by CLI)
   - Optional: `openhands` spike
6. CLI: `workplane run input <runId> --stdin "…"`
7. Cancel escalation: `SIGTERM` → grace → `SIGKILL`
8. Operator authentication for input endpoints (who may control a run)

### 3.2 Secondary goals

- Session resume metadata (checkpoint run state; full resume TBD)
- Basic TUI or web viewer for live logs (optional)
- Tailscale identity integration spike (replace static token for nodes)

### 3.3 Non-goals for v0.2.0

- GitHub PR automation
- Multi-tenant SaaS
- Built-in model hosting
- Arbitrary workflow authoring UI

---

## 4. Architecture (interactive path)

```text
Client (CLI/UI)
    │ POST /runs/:runId/input  (stdin chunk)
    ▼
Control plane → Postgres (run_input_events)
    ▲
    │ poll input (afterSequence)
Node ─┼─► PTY or stdin ─► claude / codex process
    │                      │
    └◄── POST /runs/:runId/logs (stdout/stderr)
```

Nodes remain **private**; only the control plane is addressed by clients.

---

## 5. Adapter contract (delta from v0.1.0)

```ts
export interface WorkAdapter<TInput = unknown> {
  name: string;
  kind: string;
  requiredCapabilities?: string[];
  interactive?: boolean;
  terminalMode?: "stdio" | "pty";

  run(ctx: WorkContext, input: TInput): Promise<void>;
}
```

Interactive adapters must declare `interactive: true`. PTY required when the harness needs a TTY (Claude Code).

Input event kinds (minimum):

| Kind | Purpose |
|------|---------|
| `stdin` | Text/bytes to process |
| `signal` | e.g. `SIGTERM` |
| `resize` | PTY rows/cols |

---

## 6. Security (v0.2.0)

- Input API only when run is `running` and adapter is interactive.
- Authenticated clients only (operator token or future OIDC).
- Rate limits on input events (implementation detail).

v0.1.0 node token auth remains baseline.

---

## 7. Relationship to v0.1.0 harness adapters

| Mode | Version | Behavior |
|------|---------|----------|
| Batch harness | v0.1.0 | Subprocess, fixed prompt, exit, artifacts |
| Interactive client | v0.2.0 | Long-lived process, control-plane stdin/PTY |

Same capability names (`claude-code`, `codex`) may support both modes via task flag, e.g. `payload.interactive: true`, or separate adapter names (`claude-code` vs `claude-code-interactive`).

**Recommendation:** single adapter name; `interactive` flag on task payload.

---

## 8. Definition of done (v0.2.0)

1. Start interactive Claude Code task on office node from home CLI.
2. Send at least two stdin messages; see responses in logs.
3. Cancel run; process terminates on node.
4. No direct TCP connection from client to node required.

Demo script target (from archived local-first spec, elevated to v0.2.0):

```bash
workplane task submit harness \
  --harness claude-code \
  --interactive \
  --repo … \
  --prompt "Start refactoring auth middleware"

workplane run input <runId> --stdin "Focus on tests first\n"
workplane logs <runId> --follow
```

---

## 9. Reference

Interactive contract detail: [archive spec §13.6](../../archive/specs/WORKPLANE_SPEC-v0.0-original.md).

Implementation phases will be added under `docs/codeplans/v0.2.0/` when v0.1.0 is near complete.
