import type { CreateTaskInput } from "@workplane/types";

export type SubmitKind = "shell" | "inference" | "harness";
export const HARNESSES = ["claude-code", "codex", "aider"] as const;
export type Harness = (typeof HARNESSES)[number];

export interface SubmitForm {
  kind: SubmitKind;
  command: string;
  model: string;
  prompt: string;
  harness: Harness;
  repo: string;
  harnessPrompt: string;
  interactive: boolean;
  /** Comma-separated extra capabilities. */
  extraRequires: string;
}

export function parseCapabilities(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function requiredCapabilities(form: Pick<SubmitForm, "kind" | "harness" | "extraRequires">): string[] {
  const base = form.kind === "shell" ? ["shell"] : form.kind === "inference" ? ["ollama"] : [form.harness];
  return Array.from(new Set([...base, ...parseCapabilities(form.extraRequires)]));
}

/** Maps the dialog's fields onto the task shapes the control plane validates (see apps/server/src/validation.ts). */
export function buildTaskInput(form: SubmitForm): { input: CreateTaskInput } | { error: string } {
  const requires = requiredCapabilities(form);
  switch (form.kind) {
    case "shell": {
      if (!form.command.trim()) return { error: "Enter a command to run." };
      return { input: { kind: "shell.exec", adapter: "shell", payload: { command: form.command.trim() }, requires } };
    }
    case "inference": {
      if (!form.model.trim() || !form.prompt.trim()) return { error: "A model and a prompt are required." };
      return {
        input: { kind: "inference.batch", adapter: "ollama", payload: { model: form.model.trim(), prompt: form.prompt.trim() }, requires },
      };
    }
    case "harness": {
      if (!form.repo.trim() || !form.harnessPrompt.trim()) return { error: "A repository and a prompt are required." };
      return {
        input: {
          kind: "agent.run",
          adapter: form.harness,
          payload: { prompt: form.harnessPrompt.trim(), repo: form.repo.trim(), interactive: form.interactive },
          requires,
        },
      };
    }
  }
}
