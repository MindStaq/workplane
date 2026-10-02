# @workplane/workplans

Workplan DSL and sequential runner for composing multi-step AI inference pipelines across local and frontier models.

## Install

```bash
npm install @workplane/workplans
```

## Usage

```ts
import { SequentialWorkplanRunner, LocalWorkplanContext } from "@workplane/workplans";

const plan = {
  id: "my-plan",
  name: "Summarize then critique",
  steps: [
    {
      id: "summarize",
      name: "Summarize",
      adapter: "ollama",
      provider: "ollama",
      model: "llama3",
      payload: { prompt: "Summarize: " + input },
      output: { dest: "next" },
    },
    {
      id: "critique",
      name: "Critique",
      adapter: "anthropic",
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      payload: { prompt: "Critique this summary:\n{{prevOutput}}" },
    },
  ],
};

const result = await new SequentialWorkplanRunner().run(plan, new LocalWorkplanContext());
```

## Inline providers

Steps with `provider` set to `anthropic`, `openai`, `ollama`, `shell`, or `file` run inline without dispatching to a workplane fleet node. Steps without a provider are routed via `WorkplanRunContext.resolveNode()`.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Required for `provider: "anthropic"` steps |
| `OPENAI_API_KEY` | Required for `provider: "openai"` steps |
| `OLLAMA_HOST` | Override Ollama URL (default `http://localhost:11434`) |
