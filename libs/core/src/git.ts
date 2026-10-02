import { join } from "node:path";

export interface GitExecContext {
  workspacePath: string;
  runId: string;
  log: (stream: "stdout" | "stderr" | "system", message: string, stepName?: string) => Promise<void>;
  exec: (
    command: string,
    args?: string[],
    options?: { cwd?: string },
  ) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  ensureWorkspace: (...segments: string[]) => Promise<string>;
  emitArtifact: (input: {
    type: string;
    name: string;
    path: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
}

export function repoPath(workspacePath: string): string {
  return join(workspacePath, "repo");
}

export async function createTaskBranch(context: GitExecContext, branchName: string): Promise<void> {
  const cwd = repoPath(context.workspacePath);
  await context.log("system", `creating branch ${branchName}`, "git-branch");
  const checkout = await context.exec("git", ["checkout", "-b", branchName], { cwd });
  if (checkout.exitCode !== 0) {
    throw new Error(`git checkout -b failed with exit code ${checkout.exitCode}`);
  }
}

export function defaultTaskBranchName(runId: string): string {
  return `workplane/${runId}`;
}

export async function captureGitDiff(
  context: GitExecContext,
  adapterName: string,
  artifactName = "changes.diff",
): Promise<string> {
  const cwd = repoPath(context.workspacePath);
  const diffResult = await context.exec("git", ["diff"], { cwd });
  const artifactsPath = await context.ensureWorkspace("artifacts");
  const diffPath = join(artifactsPath, artifactName);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(diffPath, diffResult.stdout, "utf8");
  await context.emitArtifact({
    type: "diff",
    name: artifactName,
    path: diffPath,
    metadata: { adapter: adapterName },
  });
  return diffPath;
}
