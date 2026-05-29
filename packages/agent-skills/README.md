# @workplane/agent-skills

Pre-built agentic workplans and the `CanonicalSkillWorkflow` interface for building structured AI skills on top of `@workplane/workplans`.

## Install

```bash
npm install @workplane/agent-skills @workplane/workplans
```

## Built-in skills

### `code-review`

Git diff → local summarize (ollama) → frontier critique (anthropic).

```ts
import { createDefaultRegistry, SequentialWorkplanRunner, LocalWorkplanContext } from "@workplane/agent-skills";
import { SequentialWorkplanRunner } from "@workplane/workplans";

const registry = createDefaultRegistry();
const skill = registry.get("code-review");
const plan = skill.buildPlan({ repo: "./my-repo", model: "claude-haiku-4-5-20251001" });
await new SequentialWorkplanRunner().run(plan, new LocalWorkplanContext());
```

### `summarize-file`

Read file → summarize with configurable provider (default: ollama).

```ts
const plan = registry.get("summarize-file").buildPlan({ file: "./README.md" });
```

## `CanonicalSkillWorkflow` interface

For complex skills with structured input validation, context building, and persistent output:

```ts
import type { CanonicalSkillWorkflow } from "@workplane/agent-skills";
import { CanonicalSkillRunner } from "@workplane/agent-skills";

class MySkill implements CanonicalSkillWorkflow<MyInput, MyOutput> {
  async resolveInputs(raw) { ... }
  async buildContext(inputs) { ... }
  async invokeAI(context) { ... }
  async persistOutput(output) { ... }
  async notify(ref) { ... }  // optional — failure never fails the run
}

const result = await new CanonicalSkillRunner().run(new MySkill(), input);
```
