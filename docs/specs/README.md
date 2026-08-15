# Specification versions

## Shipped

- **[v0.1.0 — Personal fleet execution plane](v0.1.0/WORKPLANE_SPEC.md)** — Complete  
  Route durable work—including **local inference jobs** and **batch harness invocations** (Codex, Claude Code CLI, Aider)—to capable nodes across your own machines (home, office, Tailscale).

- **[v0.2.0 — Interactive AI client workloads](v0.2.0/WORKPLANE_SPEC.md)** — Complete  
  Long-running, interactive AI coding clients with control-plane–mediated stdin/PTY, session continuity, and first-class harness adapters.

- **[v0.3.0 — DBOS decoupling, workplans, and agent skills](v0.3.0/WORKPLANE_SPEC.md)** — Complete  
  Extracted DBOS into an optional layer; introduced `workplane-workplans` (composable multi-step execution with mixed local/frontier model routing) and `workplane-agent-skills` (pre-built workplans). Includes [package strategy](v0.3.0/PACKAGE_STRATEGY.md) for multi-repo vs monorepo. Also delivered the "promoted" workplan scheduling primitives (`WorkplanSchedule`, `ScheduleBuilder`) that shipped as part of the v0.4.x releases below.

- **v0.4.0 – v0.4.3** — Complete *(no versioned spec doc; see root [README.md § Progress](../../README.md#progress) and commit history)*  
  SQLite support via Drizzle ORM, the `workplane-setup` interactive wizard, and cron-based workplan scheduling (CLI + server scheduler tick).

## Planned

Nothing is currently drafted for the next version. One known deferred item from the v0.3.0 spec remains open: real-time SSE streaming of step output to the CLI (§3.2, "Out of scope for v0.3.0").

## Deprecated / archived

| File | Notes |
|------|--------|
| [archive/specs/WORKPLANE_SPEC-v0.0-original.md](../archive/specs/WORKPLANE_SPEC-v0.0-original.md) | Pre-versioning monolith; single-machine–centric 0.1.0 goals; Claude Code listed as non-goal |
| [archive/codeplans/LOCAL_FIRST_IMPLEMENTATION_SPEC.md](../archive/codeplans/LOCAL_FIRST_IMPLEMENTATION_SPEC.md) | Superseded by [codeplans/v0.1.0/IMPLEMENTATION_SPEC.md](../codeplans/v0.1.0/IMPLEMENTATION_SPEC.md) |

The root [WORKPLANE_SPEC.md](WORKPLANE_SPEC.md) redirects to the current version.
