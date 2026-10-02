import { describe, expect, it } from "vitest";
import { buildTaskInput, parseCapabilities, requiredCapabilities, type SubmitForm } from "./submit";

const base: SubmitForm = {
  kind: "shell",
  command: " pnpm test ",
  model: "llama3.2",
  prompt: "Explain",
  harness: "claude-code",
  repo: "git@example.com:org/repo.git",
  harnessPrompt: "Look around",
  interactive: true,
  extraRequires: "git, , gpu",
};

describe("capabilities", () => {
  it("parses comma-separated capabilities", () => {
    expect(parseCapabilities(" git, ,gpu ")).toEqual(["git", "gpu"]);
  });

  it("starts from the kind's base capability and de-duplicates", () => {
    expect(requiredCapabilities({ ...base, extraRequires: "shell, git" })).toEqual(["shell", "git"]);
    expect(requiredCapabilities({ ...base, kind: "inference", extraRequires: "" })).toEqual(["ollama"]);
    expect(requiredCapabilities({ ...base, kind: "harness", harness: "codex", extraRequires: "git" })).toEqual(["codex", "git"]);
  });
});

describe("buildTaskInput", () => {
  it("builds the shell.exec shape the server validates", () => {
    expect(buildTaskInput(base)).toEqual({
      input: { kind: "shell.exec", adapter: "shell", payload: { command: "pnpm test" }, requires: ["shell", "git", "gpu"] },
    });
  });

  it("builds inference.batch for ollama", () => {
    expect(buildTaskInput({ ...base, kind: "inference", extraRequires: "" })).toEqual({
      input: { kind: "inference.batch", adapter: "ollama", payload: { model: "llama3.2", prompt: "Explain" }, requires: ["ollama"] },
    });
  });

  it("builds agent.run with the chosen harness as the adapter", () => {
    expect(buildTaskInput({ ...base, kind: "harness", harness: "aider", extraRequires: "git" })).toEqual({
      input: {
        kind: "agent.run",
        adapter: "aider",
        payload: { prompt: "Look around", repo: "git@example.com:org/repo.git", interactive: true },
        requires: ["aider", "git"],
      },
    });
  });

  it("reports missing fields instead of sending an invalid task", () => {
    expect(buildTaskInput({ ...base, command: "  " })).toEqual({ error: "Enter a command to run." });
    expect(buildTaskInput({ ...base, kind: "inference", prompt: "" })).toEqual({ error: "A model and a prompt are required." });
    expect(buildTaskInput({ ...base, kind: "harness", repo: "" })).toEqual({ error: "A repository and a prompt are required." });
  });
});
