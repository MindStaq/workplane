import type { Workplan } from "@workplane/workplans";

export interface CodeReviewOptions {
  repoPath?: string;
  model?: string;
  branch?: string;
}

export function codeReviewPlan(opts: CodeReviewOptions = {}): Workplan {
  const { repoPath = ".", model = "claude-haiku-4-5-20251001", branch } = opts;
  const diffCmd = branch ? `git diff ${branch}..HEAD` : "git diff HEAD~1";

  return {
    id: "code-review",
    name: "Code Review",
    steps: [
      {
        id: "diff",
        name: "Git Diff",
        adapter: "shell",
        provider: "shell",
        payload: { command: diffCmd, cwd: repoPath },
        output: { dest: "next" },
      },
      {
        id: "summarize",
        name: "Summarize",
        adapter: "ollama",
        provider: "ollama",
        model: "llama3",
        payload: { prompt: "Summarize these code changes concisely:\n{{prevOutput}}" },
        output: { dest: "next" },
      },
      {
        id: "critique",
        name: "Critique",
        adapter: "anthropic",
        provider: "anthropic",
        model,
        payload: { prompt: "Review this summary for correctness, security issues, and code quality:\n{{prevOutput}}" },
      },
    ],
  };
}
