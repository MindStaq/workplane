# Workplane v0.3.0 Specification

**Version:** 0.3.0  
**Status:** Complete — see [codeplans/v0.3.0/IMPLEMENTATION_PROGRESS.md](../../codeplans/v0.3.0/IMPLEMENTATION_PROGRESS.md)  
**Builds on:** [v0.2.0](../v0.2.0/WORKPLANE_SPEC.md)  
**Sub-documents:** [Package Strategy](./PACKAGE_STRATEGY.md) · [Agent Skills Design](./AGENT_SKILLS_DESIGN.md)

---

## 1. Summary

v0.3.0 is a **structural redesign** rather than a feature increment. It accomplishes three things:

1. **Decouple DBOS** from the core workplane packages — durability becomes an optional, composable layer (`workplane-dbos`) rather than a hard dependency baked into the server.
2. **Introduce workplans** (`workplane-workplans`) — a lightweight standard for composing sequences of inference and vanilla tasks, with per-step routing across local and frontier models, enabling cost-aware mixed execution.
3. **Introduce agent skills** (`workplane-agent-skills`) — pre-built agentic workplans that can optionally use DBOS for durable execution.

**v0.3.0 proof statement:**

> Define a workplan that mixes a frontier API call (Anthropic/OpenAI) with a local Ollama step, execute it via the workplane runner, observe per-step results on STDOUT — with DBOS durability available as an opt-in layer without changing the workplan definition.

---

## 2. Motivation

### 2.1 DBOS coupling is a barrier to adoption

Every server deployment currently requires Postgres + DBOS, even for users who only want basic task routing. DBOS is valuable for its durability and observability guarantees, but forcing it on the critical path:

- Raises the deployment minimum (Postgres is required even on a single machine)
- Makes it harder to run workplane in constrained environments (edge, small VMs)
- Couples infrastructure choice to workplane core

The fix is to make `ServerWorkflows` an interface with two implementations: a plain async one and a DBOS-backed one.

### 2.2 Tasks have no composition primitive

v0.1.0/v0.2.0 tasks are atomic — one adapter, one execution. There is no native way to:
- Chain outputs from step A as inputs to step B
- Route step A to a fast/cheap local model and step B to a frontier API
- Define a reusable "skill" that bundles a standard sequence of steps

Workplans close this gap without adding a full workflow engine.

### 2.3 Cost-aware execution is a first-class concern

Running everything through frontier APIs is expensive. Running everything locally limits quality. A workplan lets a user specify "summarize cheaply with Ollama, then critique with Claude" in a single composable unit. The router handles model/node selection; the workplan author expresses intent.

---

## 3. Scope

### 3.1 In scope for v0.3.0

- DBOS extraction into `workplane-dbos` (standalone optional package)
- `ServerWorkflows` interface in core — vanilla implementation ships with the server
- `workplane-workplans` package: DSL types, runner, STDOUT sink
- Basic sequential workplan execution (DAG is a stretch goal)
- Step-level routing: capability tags + optional `provider` / `model` hints
- `workplane-agent-skills` package: `CanonicalSkillWorkflow<I,O>` interface + at least two skills (code-review, summarize)
- `WorkplanSchedule` type + `ScheduleBuilder` (cron + timezone → UTC `nextRunAt`) in `@workplane/workplans`
- `step_failed` run status (retryable mid-run) + step-level metadata on `StepResult`
- Scheduler tick in `@workplane/dbos` (DBOS `@scheduled()` with idempotency key pattern)
- Multi-repo strategy decision (see [Package Strategy](./PACKAGE_STRATEGY.md))

### 3.2 Out of scope for v0.3.0

- Visual workplan editor or TUI
- Distributed step execution across multiple nodes within a single workplan run
- DBOS Cloud workflow UI integration (a benefit of `workplane-dbos`, not a v0.3.0 deliverable)
- Streaming step outputs in real-time to the CLI (STDOUT flush is fine; SSE is v0.4.0+)
- Workplan versioning, registry, or sharing

---

## 4. Package architecture

```
@workplane/server, @workplane/node, @workplane/cli   ← core infrastructure
@workplane/types, @workplane/adapter-sdk             ← shared contracts
@workplane/dbos                                      ← DBOS workflow engine adapter (optional)
@workplane/workplans                                 ← workplan DSL + sequential runner
@workplane/agent-skills                              ← pre-built skills as workplans
```

See [Package Strategy](./PACKAGE_STRATEGY.md) for multi-repo vs monorepo analysis and the recommended migration path.

---

## 5. DBOS decoupling

### 5.1 Current state

`packages/server/src/workflows.ts` calls `DBOS.registerWorkflow` and `DBOS.runStep` for every store operation. The server's route handlers call `DBOS.startWorkflow` directly. DBOS is imported unconditionally.

### 5.2 Target state

**`ServerWorkflows` interface** (already exists in `workflows.ts`) becomes the only contract the server cares about:

```ts
// packages/types/src/index.ts (or packages/core/src/workflows.ts)
export interface ServerWorkflows {
  createTask(input: CreateTaskInput): Promise<TaskRecord>;
  retryTask(taskId: string): Promise<TaskRecord | null>;
  cancelTask(taskId: string): Promise<TaskRecord | null>;
  updateRunStatus(runId: string, status: RunStatus, error?: string): Promise<RunRecord | null>;
  appendRunLogs(runId: string, logs: RunLogInput[]): Promise<number>;
  createArtifact(runId: string, input: ArtifactInput): Promise<ArtifactRecord>;
}
```

**`VanillaWorkflows`** (ships in `packages/server`):

```ts
export class VanillaWorkflows implements ServerWorkflows {
  constructor(private store: PgStore) {}
  createTask(input) { return this.store.createTask(input); }
  // ... direct pass-through
}
```

**`DbosWorkflows`** (ships in `workplane-dbos`):

```ts
import { DBOS } from "@dbos-inc/dbos-sdk";
export class DbosWorkflows implements ServerWorkflows {
  // registers DBOS workflows, wraps each store call in DBOS.runStep
}
```

**Server wiring:**

```ts
// packages/server/src/index.ts
const workflows: ServerWorkflows = process.env.WORKPLANE_USE_DBOS
  ? await importDbosWorkflows(store)   // dynamic import of workplane-dbos
  : new VanillaWorkflows(store);
```

Or more idiomatically, the user passes `--workflow-engine dbos` to the server start command.

### 5.3 DBOS init responsibility

When `workplane-dbos` is loaded, it calls `DBOS.setConfig` and `DBOS.launch` during its own initialization. The server no longer calls these directly.

### 5.4 Postgres dependency without DBOS

Without DBOS, the server still requires Postgres for task/run state. A future `workplane-sqlite` could provide a Postgres-free path — that is post-v0.3.0.

---

## 6. Workplans

### 6.1 Concept

A **workplan** is an ordered collection of **steps**. Each step declares what it needs to run (adapter, model, capabilities) and what to do with its output. The workplan runner executes steps, resolves routing, and collects results.

A workplan is the natural unit for "agentic skills" — a code-review skill is a workplan that clones a repo, summarizes changes with a cheap model, then critiques with a frontier model.

### 6.2 Core types

```ts
// packages/workplane-workplans/src/types.ts

export type StepOutputDest = "stdout" | "artifact" | "next";

export interface StepOutput {
  dest: StepOutputDest;
  format?: "text" | "json";
  artifactName?: string;  // when dest === "artifact"
}

export interface WorkplanStep {
  id: string;
  name: string;
  adapter: string;
  payload: Record<string, unknown>;
  requires?: string[];        // capability tags for routing
  provider?: string;          // "anthropic" | "openai" | "ollama" | "local"
  model?: string;             // e.g. "claude-sonnet-4-6", "llama3"
  output?: StepOutput;        // default: { dest: "stdout" }
  dependsOn?: string[];       // step IDs (for DAG; sequential if omitted)
}

export interface Workplan {
  id: string;
  name: string;
  description?: string;
  steps: WorkplanStep[];
}
```

### 6.3 Runner

The runner takes a `Workplan` and a `WorkplanRunContext` and executes steps in order. For v0.3.0, execution is **sequential** (DAG execution is a stretch goal).

```ts
export interface WorkplanRunContext {
  resolveNode(requires: string[], provider?: string): Promise<NodeHandle>;
  emitResult(stepId: string, output: string): void;
}

export interface WorkplanRunner {
  run(plan: Workplan, ctx: WorkplanRunContext): Promise<WorkplanResult>;
}

export interface WorkplanResult {
  planId: string;
  steps: StepResult[];
  succeeded: boolean;
}

export interface StepResult {
  stepId: string;
  output: string;
  exitCode: number;
  durationMs: number;
}
```

### 6.4 Routing

Step routing uses the same capability model as v0.1.0 tasks. The runner queries the workplane server for a capable node:

```
requires: ["ollama"]  → routes to a node with ollama capability
requires: ["claude-code"]  → routes to a node with claude-code
provider: "anthropic", model: "claude-sonnet-4-6"  → API-key-based, no node required
```

When `provider` is `"anthropic"` or `"openai"`, the step runs inline via the respective SDK (not dispatched to a node). This is the mechanism for mixing frontier API calls with local inference in a single workplan.

### 6.5 Output chaining

When a step's `output.dest` is `"next"`, the step result is injected into the next step's payload as `{ prevOutput: "..." }`. This enables simple pipelines:

```ts
[
  { id: "summarize", adapter: "ollama", model: "llama3", payload: { ... }, output: { dest: "next" } },
  { id: "critique",  adapter: "anthropic", model: "claude-haiku-4-5", payload: { prompt: "Critique this: {{prevOutput}}" } }
]
```

Template substitution (`{{prevOutput}}`) is resolved by the runner before dispatching each step.

### 6.6 Default output (STDOUT)

When no `output` is specified, each step's result is written to STDOUT with a step header:

```
=== step: summarize ===
<output>

=== step: critique ===
<output>
```

### 6.7 DBOS integration (optional)

When `workplane-dbos` is present, the workplan runner can be wrapped with a `DurableWorkplanRunner` that checkpoints each step result in DBOS. If the process crashes mid-plan, DBOS replays from the last completed step. This is an additive wrapper — workplan authors write the same `Workplan` type regardless.

---

## 7. Agent skills

### 7.1 Concept

An **agent skill** is a pre-built, named workplan. Skills are defined as TypeScript modules that export a `Workplan` factory function:

```ts
// packages/workplane-agent-skills/src/skills/code-review.ts
export function codeReviewSkill(opts: CodeReviewOptions): Workplan {
  return {
    id: `code-review-${opts.repo}`,
    name: "Code Review",
    steps: [
      {
        id: "diff",
        adapter: "shell",
        requires: ["shell", "git"],
        payload: { command: "git diff HEAD~1", cwd: opts.repoPath },
        output: { dest: "next" }
      },
      {
        id: "summarize",
        adapter: "ollama",
        requires: ["ollama"],
        payload: { model: "llama3", prompt: "Summarize these changes:\n{{prevOutput}}" },
        output: { dest: "next" }
      },
      {
        id: "critique",
        provider: "anthropic",
        adapter: "anthropic",
        model: opts.model ?? "claude-haiku-4-5",
        payload: { prompt: "Review this summary for correctness and security issues:\n{{prevOutput}}" }
      }
    ]
  };
}
```

### 7.2 Skills in v0.3.0

| Skill | Description |
|-------|-------------|
| `code-review` | Diff → local summarize → frontier critique |
| `summarize-file` | Read file → local or frontier summarize → STDOUT |

Additional skills are added in subsequent versions or by users building on `workplane-workplans`.

### 7.3 CLI integration

```bash
workplane skill run code-review --repo ./my-repo --model claude-haiku-4-5
workplane skill list
```

Skills surface as a first-class CLI verb.

---

## 8. API additions for workplans

To support workplan execution through the fleet (not just inline), the control plane gains:

```
POST /workplans          → submit a workplan for execution
GET  /workplans/:id      → get workplan run status
GET  /workplans/:id/steps → get per-step results
```

These endpoints accept the `Workplan` type and decompose it into individual task submissions internally. This allows long-running workplans to survive client disconnection.

Workplan-level status: `running` → `succeeded` | `failed` (first step failure halts the plan by default).

---

## 9. Data model additions

```sql
-- Workplan runs
CREATE TABLE workplan_runs (
  id           TEXT PRIMARY KEY,
  plan_id      TEXT NOT NULL,
  plan_name    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'running',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  error        TEXT
);

-- Per-step results linked to a workplan run
CREATE TABLE workplan_step_results (
  id              TEXT PRIMARY KEY,
  workplan_run_id TEXT NOT NULL REFERENCES workplan_runs(id),
  step_id         TEXT NOT NULL,
  step_name       TEXT NOT NULL,
  output          TEXT,
  exit_code       INTEGER,
  duration_ms     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 10. Versioning and backwards compatibility

- The `workplane` core package remains API-compatible with v0.1.0/v0.2.0.
- DBOS remains the default for existing deployments; `VanillaWorkflows` is additive.
- Workplan types are new — no existing code is broken.
- Agent skills are new packages — nothing removed from the adapters.

Existing `packages/server/src/workflows.ts` becomes `packages/server/src/workflows-dbos.ts` and a `VanillaWorkflows` class is introduced in `packages/server/src/workflows-vanilla.ts`.

---

## 11. Definition of done (v0.3.0)

1. `packages/server` starts and routes tasks without `DBOS` imported, using `VanillaWorkflows`.
2. `workplane-dbos` can be installed and passed to the server to restore full DBOS durability.
3. A `Workplan` with two steps (one Ollama, one Anthropic API) executes sequentially; both outputs appear on STDOUT.
4. `workplane skill run code-review` works on a local repo with mixed local/frontier steps.
5. All existing v0.1.0 tests pass without modification.

---

## 12. Reference

- Current DBOS usage: `packages/server/src/workflows.ts`
- Adapter SDK contract: `packages/adapter-sdk/src/index.ts`
- Package strategy: [PACKAGE_STRATEGY.md](./PACKAGE_STRATEGY.md)
- Implementation plan: [codeplans/v0.3.0/IMPLEMENTATION_SPEC.md](../../codeplans/v0.3.0/IMPLEMENTATION_SPEC.md)
