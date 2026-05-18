import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WorkAdapter } from "../../adapter-sdk/src/index.js";

interface AiderPayload {
  prompt: string;
  model?: string;
}

export const aiderAdapter: WorkAdapter<AiderPayload> = {
  name: "aider",
  kind: "agent.run",
  async run(context, payload) {
    const repoPath = join(context.workspacePath, "repo");
    const args = ["--message", payload.prompt];
    if (payload.model) {
      args.unshift("--model", payload.model);
    }

    const result = await context.exec("aider", args, { cwd: repoPath });
    if (result.exitCode !== 0) {
      throw new Error(`aider failed with exit code ${result.exitCode}`);
    }

    const diffResult = await context.exec("git", ["diff"], { cwd: repoPath });
    const artifactsPath = await context.ensureWorkspace("artifacts");
    const diffPath = join(artifactsPath, "changes.diff");
    await writeFile(diffPath, diffResult.stdout, "utf8");
    await context.emitArtifact({
      type: "diff",
      name: "changes.diff",
      path: diffPath,
      metadata: {
        adapter: "aider",
      },
    });
  },
};
