# Agent Skills Design Note

**Version:** 0.3.0  
**Status:** Adopted — implemented as part of v0.3.0 (`@workplane/agent-skills`)  
**Parent spec:** [WORKPLANE_SPEC.md](./WORKPLANE_SPEC.md)  
**Input:** MindStaq Skill Execution Engine spec (`@mindstaq/skill-engine`, 2026-05-14)

---

## 1. Context

The MindStaq Morpheus app requires a durable skill execution engine for AI-powered "Action Cards" — multi-step workflows with scheduled execution, step-level retry, and per-user run history. An earlier draft of that engine (`@mindstaq/skill-engine`) was designed independently before workplane existed.

This note records the alignment analysis and its impact on `@workplane/agent-skills` and `@workplane/workplans`.

---

## 2. Key finding: library, not fleet

MindStaq's skill engine should **import workplane packages as a library** — not route skills through the workplane fleet infrastructure.

The fleet routing (node registration, capability matching, polling) adds no value for Morpheus: skills always run on a single dedicated worker process. Importing `@workplane/workplans` and `@workplane/dbos` directly gives the durable runner and DBOS layer without the fleet overhead.

```
@mindstaq/skill-engine
  imports @workplane/workplans   → CanonicalSkillWorkflow, runner, scheduler types
  imports @workplane/dbos        → DbosWorkflows (step checkpointing, idempotency)
  implements MindStaq-specific step bodies
```

---

## 3. What the MindStaq spec contributes to workplane

The MindStaq design is a validated, concrete instance of what `@workplane/agent-skills` needs to support. It contributes the following generalizations.

### 3.1 Canonical skill workflow interface

The 5-step pipeline (resolveInputs → buildContext → invokeAI → persistOutput → notify) is more useful as a **typed interface** in `@workplane/agent-skills` than as an implicit convention. Consumers implement it; the runner executes it.

```ts
// @workplane/agent-skills: canonical interface
export interface CanonicalSkillWorkflow<TInput = unknown, TOutput = unknown> {
  resolveInputs(raw: TInput): Promise<ResolvedInputs<TInput>>;
  buildContext(inputs: ResolvedInputs<TInput>): Promise<SkillContext>;
  invokeAI(context: SkillContext): Promise<AIOutput<TOutput>>;
  persistOutput(output: AIOutput<TOutput>): Promise<OutputRef>;
  notify?(ref: OutputRef): Promise<void>;  // optional; failure here never fails the run
}
```

The runner calls each method in order, checkpointing between steps when DBOS is enabled.

### 3.2 Step-level metadata

Steps should be able to emit structured metadata alongside their result. The MindStaq spec emits `{ itemsFetched, tokensEstimated }` from `buildRagContext`. This is a pattern worth making first-class:

```ts
export interface StepResult<T = unknown> {
  output: T;
  metadata?: Record<string, unknown>;  // e.g. { itemsFetched: 12, tokensEstimated: 4200 }
  durationMs: number;
}
```

### 3.3 Run status model

The distinction between `step_failed` (retryable, mid-run) and `failed` (terminal, retries exhausted) is richer than workplane's current binary succeeded/failed:

```ts
export type SkillRunStatus =
  | 'pending'
  | 'running'
  | 'step_failed'   // retryable — a step failed but the run can resume
  | 'completed'
  | 'failed'        // terminal — all retries exhausted
  | 'cancelled';
```

The `WorkplanResult` type in `@workplane/workplans` should adopt this distinction.

### 3.4 Scheduler (`WorkplanSchedule`)

The MindStaq scheduler design — DBOS `@scheduled()` tick polling for due schedules, cron expression + timezone, idempotency key `${scheduleId}:${isoTimestamp}` — is directly reusable as `@workplane/workplans`'s scheduler primitive. This is more complete than what the current v0.3.0 spec planned.

```ts
// @workplane/workplans
export interface WorkplanSchedule {
  id: string;
  planId: string;
  name: string;
  cronExpression: string;
  timezone: string;                   // IANA tz string, e.g. "America/New_York"
  inputs: Record<string, unknown>;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;                 // UTC; computed by ScheduleBuilder
  createdBy?: string;
}
```

`ScheduleBuilder` (cron + timezone → UTC `nextRunAt` using `cron-parser`) ships in `@workplane/workplans`. The idempotency key pattern ships in `@workplane/dbos`'s scheduler tick.

---

## 4. What stays in `@mindstaq/skill-engine`

These are MindStaq-specific step *implementations*, not workplane concerns:

| MindStaq step | Why it stays in MindStaq |
|---------------|--------------------------|
| `buildRagContext` | Calls MindStaq REST API (`/a/v2.0/project` etc.); applies `rag_scope` from Action Card definition |
| `persistOutput` | Writes to Solaria/MongoDB (`contentitem`, `chatmessage`, notification objects) |
| `notifyUser` | Morpheus SSE channel; in-app notification badges |
| `shouldEscalateToFrontier()` | MindStaq's own cost/quality routing logic |
| `SkillRun` as Solaria object | Has `streamId`, `workspaceId`, Solaria `links` — domain object, not execution state |
| `SkillSchedule` as Solaria object | Same — domain object with Morpheus-specific fields |
| Vercel AI SDK invocation | `generateText`/`generateObject` streaming into Morpheus chat UI |

---

## 5. Data layer: two concerns, not a conflict

Workplane's Postgres tracks **execution state** — step checkpoints, DBOS workflow IDs, retry counts, run duration. Solaria/MongoDB tracks the **domain object** — `SkillRun` with its `outputRef`, workspace links, token usage for billing, cross-tenant audit.

The MindStaq `persistOutput` step writes to both in a single step body:

```ts
async persistOutput(output: AIOutput): Promise<OutputRef> {
  // 1. Write domain object to Solaria
  const note = await ContentRepository.createNoteFromSkillRun(output);
  // 2. Emit workplane artifact (captured in Postgres execution state)
  await this.ctx.emitArtifact({ type: 'note', name: 'output', path: note._id });
  return { CN: 'contentitem', id: note._id };
}
```

No dual-write conflict — the layers are orthogonal.

---

## 6. AI SDK: no conflict

For **background/scheduled runs** (no active user session), streaming is not required. The `invokeAI` step calls the Anthropic SDK directly — consistent with how `@workplane/workplans` inline providers work.

For **user-triggered runs** where the user is watching, streaming goes through Morpheus's own SSE channel, not through workplane. The skill's `invokeAI` step can use Vercel AI SDK and collect the full response; workplane only sees the completed step result. The streaming UI is a Morpheus responsibility.

---

## 7. Impact on v0.3.0 spec

The following items are promoted from "future" to in-scope for v0.3.0 based on this alignment:

| Change | Original v0.3.0 | After alignment |
|--------|----------------|-----------------|
| `CanonicalSkillWorkflow` interface | Not planned | In scope — `@workplane/agent-skills` |
| `WorkplanSchedule` type + `ScheduleBuilder` | Deferred | In scope — `@workplane/workplans` |
| `step_failed` run status | Not planned | In scope — `@workplane/workplans` |
| Step-level metadata on `StepResult` | Not planned | In scope — `@workplane/workplans` |
| Scheduler tick in `@workplane/dbos` | Not planned | In scope — `@workplane/dbos` |

The following remain out of scope for v0.3.0 (MindStaq-specific, not workplane concerns):

- Solaria/MongoDB integration
- Vercel AI SDK streaming adapter
- MindStaq RAG context builder
- Morpheus frontend components

---

## 8. Resulting architecture

```
@workplane/workplans
  ├── WorkplanStep, Workplan (existing)
  ├── CanonicalSkillWorkflow<I,O> interface  ← new
  ├── WorkplanSchedule type                  ← new
  ├── ScheduleBuilder (cron + tz → nextRunAt) ← new
  ├── step_failed run status                 ← new
  └── StepResult with metadata               ← refined

@workplane/dbos
  ├── DbosWorkflows (existing)
  └── scheduler tick (DBOS @scheduled())     ← new

@workplane/agent-skills
  ├── CanonicalSkillRunner (executes CanonicalSkillWorkflow)  ← new
  ├── code-review skill (existing)
  └── summarize-file skill (existing)

@mindstaq/skill-engine  (separate repo/workspace)
  ├── imports @workplane/workplans, @workplane/dbos
  ├── MindStaqSkillWorkflow implements CanonicalSkillWorkflow
  │   ├── resolveInputs  (Action Card schema validation, @me resolution)
  │   ├── buildContext   (MindStaq REST API + rag_scope)
  │   ├── invokeAI       (Vercel AI SDK or direct Anthropic SDK)
  │   ├── persistOutput  (Solaria write + workplane artifact)
  │   └── notify         (Morpheus SSE / in-app)
  ├── MindStaqSkillSchedule extends WorkplanSchedule  (adds Solaria fields)
  └── skill-engine-worker entry point (DBOS.launch)
```
