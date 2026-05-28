# Specification versions

## Active

- **[v0.1.0 — Personal fleet execution plane](v0.1.0/WORKPLANE_SPEC.md)**  
  Route durable work—including **local inference jobs** and **batch harness invocations** (Codex, Claude Code CLI, Aider)—to capable nodes across your own machines (home, office, Tailscale).

## Planned

- **[v0.2.0 — Interactive AI client workloads](v0.2.0/WORKPLANE_SPEC.md)**  
  Long-running, interactive AI coding clients with control-plane–mediated stdin/PTY, session continuity, and first-class harness adapters.

- **[v0.3.0 — DBOS decoupling, workplans, and agent skills](v0.3.0/WORKPLANE_SPEC.md)**  
  Extract DBOS into an optional layer; introduce `workplane-workplans` (composable multi-step execution with mixed local/frontier model routing) and `workplane-agent-skills` (pre-built workplans). Includes [package strategy](v0.3.0/PACKAGE_STRATEGY.md) for multi-repo vs monorepo.

## Deprecated / archived

| File | Notes |
|------|--------|
| [archive/specs/WORKPLANE_SPEC-v0.0-original.md](../archive/specs/WORKPLANE_SPEC-v0.0-original.md) | Pre-versioning monolith; single-machine–centric 0.1.0 goals; Claude Code listed as non-goal |
| [archive/codeplans/LOCAL_FIRST_IMPLEMENTATION_SPEC.md](../archive/codeplans/LOCAL_FIRST_IMPLEMENTATION_SPEC.md) | Superseded by [codeplans/v0.1.0/IMPLEMENTATION_SPEC.md](../codeplans/v0.1.0/IMPLEMENTATION_SPEC.md) |

The root [WORKPLANE_SPEC.md](WORKPLANE_SPEC.md) redirects to the current version.
