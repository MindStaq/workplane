import {
  captureGitDiff,
  createTaskBranch,
  defaultTaskBranchName,
  repoPath,
  type GitExecContext,
} from "@workplane/core";
import type { WorkAdapter } from "@workplane/adapter-sdk";

interface AiderPayload {
  prompt: string;
  model?: string;
  testCommand?: string;
}

export const aiderAdapter: WorkAdapter<AiderPayload> = {
  name: "aider",
  kind: "agent.run",
  async run(context, payload) {
    const cwd = repoPath(context.workspacePath);
    await createTaskBranch(context as GitExecContext, defaultTaskBranchName(context.runId));

    const args = ["--yes", "--message", payload.prompt];
    if (payload.model) {
      args.unshift("--model", payload.model);
    }

    const result = await context.exec("aider", args, { cwd });
    if (result.exitCode !== 0) {
      throw new Error(`aider failed with exit code ${result.exitCode}`);
    }

    await captureGitDiff(context as GitExecContext, "aider");

    if (payload.testCommand) {
      await context.log("system", `running test command: ${payload.testCommand}`, "run-tests");
      const testResult = await context.exec("/bin/sh", ["-lc", payload.testCommand], { cwd });
      if (testResult.exitCode !== 0) {
        throw new Error(`test command failed with exit code ${testResult.exitCode}`);
      }
    }
  },
};
