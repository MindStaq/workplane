import type { SkillEntry } from "../types.js";
import { codeReviewPlan } from "./code-review.js";
import { helloPlan } from "./hello.js";
import { summarizeFilePlan } from "./summarize-file.js";

export class SkillRegistry {
  private readonly skills = new Map<string, SkillEntry>();

  register(entry: SkillEntry): void {
    this.skills.set(entry.name, entry);
  }

  get(name: string): SkillEntry | undefined {
    return this.skills.get(name);
  }

  list(): SkillEntry[] {
    return Array.from(this.skills.values());
  }
}

export function createDefaultRegistry(): SkillRegistry {
  const registry = new SkillRegistry();

  registry.register({
    name: "hello",
    description: "Shell echo (scheduler smoke test)",
    buildPlan: (opts) =>
      helloPlan({
        message: typeof opts.message === "string" ? opts.message : undefined,
      }),
  });

  registry.register({
    name: "code-review",
    description: "Git diff → local summarize (ollama) → frontier critique (anthropic)",
    buildPlan: (opts) =>
      codeReviewPlan({
        repoPath: typeof opts.repo === "string" ? opts.repo : undefined,
        model: typeof opts.model === "string" ? opts.model : undefined,
        branch: typeof opts.branch === "string" ? opts.branch : undefined,
      }),
  });

  registry.register({
    name: "summarize-file",
    description: "Read file → summarize with configurable provider (default: ollama)",
    buildPlan: (opts) => {
      const filePath = typeof opts.file === "string" ? opts.file : "";
      if (!filePath) throw new Error("--file is required for summarize-file");
      return summarizeFilePlan({
        filePath,
        provider: typeof opts.provider === "string" ? opts.provider : undefined,
        model: typeof opts.model === "string" ? opts.model : undefined,
      });
    },
  });

  return registry;
}

export function listSkills(registry: SkillRegistry): void {
  for (const skill of registry.list()) {
    process.stdout.write(`  ${skill.name.padEnd(20)} ${skill.description}\n`);
  }
}
