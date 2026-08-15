# v0.3.0 implementation progress

**Spec:** [IMPLEMENTATION_SPEC.md](./IMPLEMENTATION_SPEC.md)
**Merged via:** [PR #3 — v0.3.0: DBOS extraction, workplans, agent skills, npm publish pipeline](https://github.com/MindStaq/workplane/pull/3)
**Tag:** `v0.3.0`

## Summary

DBOS decoupled into an optional `@workplane/dbos` package; `@workplane/workplans` (workplan DSL +
sequential runner + inline providers) and `@workplane/agent-skills` (pre-built skills: `code-review`,
`summarize-file`) shipped as independently publishable packages; Changesets-based npm publish pipeline
added for all Tier 1 library packages. The "promoted" scheduling primitives from §2.0 of the
implementation spec (`WorkplanSchedule`, `ScheduleBuilder`) also landed in this phase and were later
wired into the server/CLI as full workplan scheduling in v0.4.2.

## Phase checklist

| Phase | Status | Notes |
|-------|--------|-------|
| 1 — DBOS extraction | Done | `ServerWorkflows` interface in `@workplane/types`; `VanillaWorkflows` (default) and `DbosWorkflows` (`@workplane/dbos`, opt-in via `WORKPLANE_USE_DBOS=true`) |
| 2 — `@workplane/workplans` package | Done | DSL types, `SequentialWorkplanRunner`, inline `anthropic`/`openai`/`ollama` providers, `{{prevOutput}}` template substitution, STDOUT sink, `ScheduleBuilder` (cron-parser + IANA tz → UTC `nextRunAt`) |
| 3 — `@workplane/agent-skills` package | Done | `CanonicalSkillWorkflow` interface, `CanonicalSkillRunner`, `code-review` and `summarize-file` skills, `SkillRegistry`, `workplane skill list` / `workplane skill run` CLI commands |
| 4 — Monorepo tooling | Done | Changesets configured (`.changeset/config.json`), public package metadata (`private: false`, license, repository, files) set for all Tier 1 packages, `.github/workflows/release.yml` publish workflow, per-package READMEs added |

## Verify locally

```bash
pnpm test
pnpm build:libs

# Inline two-step workplan (Ollama -> Anthropic), no fleet required
workplane skill run code-review --repo . --model claude-haiku-4-5-20251001
workplane skill run summarize-file --file ./README.md
```

## Known limits / carried forward

- DAG-based (non-sequential) workplan execution remains a stretch goal — not implemented.
- Distributed step execution across multiple nodes within a single workplan run — out of scope, unchanged.
- Real-time SSE streaming of step output to the CLI — deferred; still open as of v0.4.3 (STDOUT flush only).
- Full workplan scheduling (server routes, CLI `schedule` commands, DBOS scheduled tick) builds on the
  `ScheduleBuilder` primitive introduced here and shipped separately in v0.4.2 — see root
  [README.md § Progress](../../../README.md#progress).
