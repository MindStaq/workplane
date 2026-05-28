# v0.3.0 Implementation Plan

**Version:** 0.3.0  
**Status:** Draft  
**Spec:** [docs/specs/v0.3.0/WORKPLANE_SPEC.md](../../specs/v0.3.0/WORKPLANE_SPEC.md)  
**Depends on:** v0.1.0 complete, v0.2.0 complete (or at least its interactive adapter contract merged)

---

## Overview

This plan executes the v0.3.0 redesign in four independent phases. Phases 1 and 2 can proceed in parallel once branched; Phases 3 and 4 depend on Phase 2.

| Phase | Focus | Depends on |
|-------|-------|-----------|
| 1 | DBOS extraction | v0.1.0 |
| 2 | `workplane-workplans` package | v0.1.0 |
| 3 | `workplane-agent-skills` package | Phase 2 |
| 4 | Monorepo tooling (Changesets, publish config) | Phases 1–3 |

---

## Phase 1 — DBOS extraction

**Goal:** The core server starts and routes tasks without importing DBOS. DBOS durability is available via `workplane-dbos`.

### 1.1 Introduce `ServerWorkflows` as a shared interface

- [ ] Move `ServerWorkflows` interface from `packages/server/src/workflows.ts` to `packages/types/src/index.ts`
- [ ] Update `packages/server/src/workflows.ts` to import and implement it

### 1.2 Create `VanillaWorkflows`

- [ ] Create `packages/server/src/workflows-vanilla.ts`
- [ ] Implement `VanillaWorkflows implements ServerWorkflows` with direct `PgStore` pass-through (no DBOS)
- [ ] Write unit tests for `VanillaWorkflows` covering all six methods

### 1.3 Create `packages/workplane-dbos/`

- [ ] Scaffold `packages/dbos/package.json` (name: `@workplane/dbos`; peer deps: `@dbos-inc/dbos-sdk`, `@workplane/server`)
- [ ] Create `packages/dbos/src/index.ts`
- [ ] Move DBOS workflow registrations from `packages/server/src/workflows.ts` into `DbosWorkflows` class
- [ ] Export `DbosWorkflows` class and a `createDbosWorkflows(store: PgStore): ServerWorkflows` factory

### 1.4 Update server to accept injected `ServerWorkflows`

- [ ] Refactor `packages/server/src/index.ts` to accept `ServerWorkflows` as a constructor argument (dependency injection)
- [ ] Default to `VanillaWorkflows` when `WORKPLANE_USE_DBOS` env var is not set
- [ ] When `WORKPLANE_USE_DBOS=true`, dynamically import `workplane-dbos` and use `DbosWorkflows`
- [ ] Move `DBOS.setConfig` / `DBOS.launch` / `DBOS.shutdown` calls into the `DbosWorkflows` lifecycle

### 1.5 Tests and regression

- [ ] All existing server tests pass with `VanillaWorkflows`
- [ ] Smoke test: start server with `WORKPLANE_USE_DBOS=true` and confirm DBOS workflows execute
- [ ] Smoke test: start server without the env var and confirm it boots without any DBOS import

**Acceptance criterion:** `pnpm test` passes; server starts without Postgres DBOS schema if `WORKPLANE_USE_DBOS` is unset (though it still needs Postgres for the app schema).

---

## Phase 2 — `workplane-workplans` package

**Goal:** A runnable workplan composed of two steps (one Ollama, one Anthropic API) executes sequentially and prints results to STDOUT.

### 2.0 Promoted items (from MindStaq alignment — see AGENT_SKILLS_DESIGN.md)

These items were originally deferred but are in scope for v0.3.0:

- [ ] Add `step_failed` to `WorkplanStatus` type (alongside `running`, `completed`, `failed`, `cancelled`)
- [ ] Add `metadata?: Record<string, unknown>` to `StepResult`
- [ ] Add `WorkplanSchedule` type to `packages/workplans/src/types.ts`
- [ ] Implement `ScheduleBuilder` in `packages/workplans/src/schedule-builder.ts` — uses `cron-parser` with `tz` option to compute UTC `nextRunAt` from cron expression + IANA timezone string
- [ ] Add scheduler tick to `packages/dbos/src/scheduler.ts` — DBOS `@DBOS.scheduled()` cron that polls for due `WorkplanSchedule`s, launches runs with idempotency key `${scheduleId}:${scheduledTime.toISOString()}`

### 2.1 Scaffold package

- [ ] Create `packages/workplans/package.json` (name: `@workplane/workplans`)
  - Dependencies: `@workplane/adapter-sdk` (`workspace:*`), `@anthropic-ai/sdk` (optional peer dep), `ollama` (optional peer dep)
- [ ] Create `packages/workplans/src/types.ts` — `Workplan`, `WorkplanStep`, `StepOutput`, `WorkplanResult`, `StepResult`, `WorkplanRunContext`, `WorkplanRunner` (see spec §6.2–6.3)
- [ ] Create `packages/workplans/src/index.ts` — re-exports

### 2.2 Implement inline provider adapters

These adapters run a step locally without dispatching to a workplane node.

- [ ] `packages/workplans/src/providers/anthropic.ts`
  - Accept `model`, `prompt`, `payload` — call Anthropic Messages API
  - Returns raw text output
  - Requires `ANTHROPIC_API_KEY` in env
- [ ] `packages/workplans/src/providers/openai.ts`
  - Same shape for OpenAI Chat Completions
  - Requires `OPENAI_API_KEY` in env
- [ ] `packages/workplans/src/providers/ollama.ts`
  - Calls local Ollama HTTP API (default `http://localhost:11434`)
  - Returns raw text output

### 2.3 Implement the sequential runner

- [ ] Create `packages/workplans/src/runner.ts`
  - `SequentialWorkplanRunner implements WorkplanRunner`
  - Iterates `plan.steps` in order
  - For each step:
    1. Resolve provider: if `step.provider` in `["anthropic", "openai", "ollama"]`, use inline provider
    2. Otherwise, dispatch to workplane server via `WorkplanRunContext.resolveNode()`
    3. Apply `{{prevOutput}}` template substitution in `step.payload` if previous step had `dest: "next"`
    4. Collect result
  - Write step output to STDOUT when `dest === "stdout"` (default)
  - Store result for chaining when `dest === "next"`
- [ ] Template substitution helper: `packages/workplans/src/template.ts`

### 2.4 STDOUT sink

- [ ] Create `packages/workplans/src/sinks/stdout.ts`
  - Formats `=== step: <name> ===\n<output>\n` per step
  - Default when no `output.dest` specified

### 2.5 `WorkplanRunContext` default implementation

- [ ] Create `packages/workplans/src/context.ts`
  - `LocalWorkplanContext` — resolves nodes by calling the workplane server HTTP API
  - Takes `serverUrl` and `nodeToken` from env / constructor

### 2.6 Tests

- [ ] Unit test for `SequentialWorkplanRunner` with mock providers
- [ ] Unit test for template substitution
- [ ] Integration test (manual / UAT): two-step plan with Ollama → STDOUT

**Acceptance criterion:** `node run-plan.ts` (a test script) executes a two-step workplan and prints both outputs.

---

## Phase 3 — `workplane-agent-skills` package

**Goal:** Two pre-built skills (`code-review`, `summarize-file`) run via `workplane skill run`.

### 3.1 Scaffold package

- [ ] Create `packages/agent-skills/package.json` (name: `@workplane/agent-skills`)
  - Dependencies: `@workplane/workplans` (`workspace:*`)
- [ ] Create `packages/agent-skills/src/index.ts`
- [ ] Create `packages/agent-skills/src/skills/index.ts` — skill registry
- [ ] Define `CanonicalSkillWorkflow<TInput, TOutput>` interface in `packages/agent-skills/src/types.ts`
  - Methods: `resolveInputs`, `buildContext`, `invokeAI`, `persistOutput`, optional `notify`
- [ ] Implement `CanonicalSkillRunner` in `packages/agent-skills/src/runner.ts`
  - Executes the 5-step pipeline; checkpoints between steps when DBOS is active; `notify` failure never fails the run

### 3.2 Implement `code-review` skill

- [ ] Create `packages/agent-skills/src/skills/code-review.ts`
- [ ] Steps: `git diff` (shell) → `summarize` (ollama) → `critique` (anthropic)
- [ ] Accept options: `repoPath`, `model` (frontier model, default `claude-haiku-4-5`), `branch`

### 3.3 Implement `summarize-file` skill

- [ ] Create `packages/agent-skills/src/skills/summarize-file.ts`
- [ ] Steps: read file (shell) → summarize (configurable provider, default `ollama`)
- [ ] Accept options: `filePath`, `provider`, `model`

### 3.4 Skill registry

- [ ] `SkillRegistry` maps skill name → factory function
- [ ] `listSkills()` returns available skill names and descriptions

### 3.5 CLI integration

- [ ] Add `skill` command to `packages/cli/src/index.ts`
  - `workplane skill list` — print skill names and descriptions
  - `workplane skill run <name> [options]` — run a named skill
- [ ] Parse skill-specific options via a generic `--option key=value` or per-skill flags

### 3.6 Tests

- [ ] Unit test for `code-review` skill plan structure (assert step IDs and adapter names)
- [ ] Unit test for `summarize-file` skill plan structure
- [ ] Manual UAT: `workplane skill run code-review --repo . --model claude-haiku-4-5`

---

## Phase 4 — Monorepo tooling

**Goal:** `pnpm changeset` works; all publishable packages have correct `package.json` metadata.

### 4.1 Changesets setup

- [ ] `pnpm add -D -w @changesets/cli`
- [ ] `pnpm changeset init`
- [ ] Add `.changeset/config.json` with `baseBranch: "main"` and `access: "public"`

### 4.2 Package metadata

For each public package:
- [ ] Set `"private": false`
- [ ] Add `"license": "MIT"` (or chosen license)
- [ ] Add `"repository"` field
- [ ] Add `"files"` array to limit what gets published (e.g., `["dist", "src"]`)
- [ ] Verify `"main"`, `"types"`, and `"exports"` fields are correct

Packages to make public (all under `@workplane/` scope):
- `@workplane/types`
- `@workplane/adapter-sdk`
- `@workplane/adapter-aider`, `@workplane/adapter-claude-code`, `@workplane/adapter-codex`, `@workplane/adapter-harness`, `@workplane/adapter-ollama`, `@workplane/adapter-shell`
- `@workplane/server`
- `@workplane/node`
- `@workplane/cli`
- `@workplane/dbos`
- `@workplane/workplans`
- `@workplane/agent-skills`

### 4.3 CI publish workflow

- [ ] Add `.github/workflows/release.yml`
  - On push to `main`, run `pnpm changeset publish`
  - Requires `NPM_TOKEN` secret

### 4.4 README updates

- [ ] Root `README.md`: add architecture diagram and package descriptions
- [ ] Per-package `README.md` for the three new packages (minimal: what it is, how to install, one example)

---

## Cross-cutting concerns

### Error handling in workplans

- A step failure halts the workplan by default (the runner sets `succeeded: false` and stops)
- `WorkplanStep` can opt into `continueOnError: true` to allow the next step to run

### Environment variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | workplane-workplans | Anthropic provider |
| `OPENAI_API_KEY` | workplane-workplans | OpenAI provider |
| `OLLAMA_HOST` | workplane-workplans | Override Ollama URL (default `http://localhost:11434`) |
| `WORKPLANE_USE_DBOS` | workplane server | Enable DBOS workflow engine |

### Backwards compatibility checklist

- [ ] v0.1.0 task submission still works via `POST /tasks`
- [ ] Existing `pnpm uat:*` scripts still pass
- [ ] Node polling and heartbeat unchanged
- [ ] `WORKPLANE_NODE_TOKEN` and `WORKPLANE_OPERATOR_TOKEN` auth unchanged

---

## Milestones

| Milestone | Phases complete | Observable outcome |
|-----------|----------------|-------------------|
| M1 | Phase 1 | Server boots without DBOS import |
| M2 | Phase 2 | Two-step workplan runs via script |
| M3 | Phase 3 | `workplane skill run code-review` works |
| M4 | Phase 4 | `pnpm changeset publish` dry-run succeeds |
