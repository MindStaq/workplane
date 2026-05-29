import { join } from "node:path";
import {
  captureGitDiff,
  createTaskBranch,
  defaultTaskBranchName,
  repoPath,
  type GitExecContext,
} from "@workplane/core";
import type { WorkAdapter } from "@workplane/adapter-sdk";

export interface HarnessPayload {
  prompt: string;
  model?: string;
  testCommand?: string;
  branch?: string;
  taskBranch?: string;
  extraArgs?: string[];
  interactive?: boolean;
}

export interface HarnessAdapterOptions {
  name: string;
  kind: string;
  binary: string | (() => string);
  interactive?: boolean;
  terminalMode?: "stdio" | "pty";
  defaultArgs?: string[];
  buildArgs?: (payload: HarnessPayload) => string[];
  buildInteractiveArgs?: (payload: HarnessPayload) => string[];
}

function resolveBinary(binary: string | (() => string)): string {
  return typeof binary === "function" ? binary() : binary;
}

export function createHarnessAdapter(options: HarnessAdapterOptions): WorkAdapter<HarnessPayload> {
  return {
    name: options.name,
    kind: options.kind,
    interactive: options.interactive,
    terminalMode: options.terminalMode,
    async run(context, payload) {
      const cwd = repoPath(context.workspacePath);
      const branchName = payload.taskBranch ?? defaultTaskBranchName(context.runId);
      await createTaskBranch(context as GitExecContext, branchName);

      const binary = resolveBinary(options.binary);

      if (payload.interactive && options.buildInteractiveArgs) {
        const interactiveArgs = options.buildInteractiveArgs(payload);
        const execPromise = context.exec(binary, interactiveArgs, { cwd });
        await new Promise<void>((resolve) => setTimeout(resolve, 300));
        context.writeStdin?.(payload.prompt + "\n");
        const result = await execPromise;
        if (result.exitCode !== 0) {
          throw new Error(`${binary} failed with exit code ${result.exitCode}`);
        }
        await captureGitDiff(context as GitExecContext, options.name);
        return;
      }

      const extra = payload.extraArgs ?? options.defaultArgs ?? [];
      const promptArgs = options.buildArgs ? options.buildArgs(payload) : [...extra, payload.prompt];
      const result = await context.exec(binary, promptArgs, { cwd });
      if (result.exitCode !== 0) {
        throw new Error(`${binary} failed with exit code ${result.exitCode}`);
      }

      await captureGitDiff(context as GitExecContext, options.name);

      if (payload.testCommand) {
        await context.log("system", `running test command: ${payload.testCommand}`, "run-tests");
        const testResult = await context.exec("/bin/sh", ["-lc", payload.testCommand], { cwd });
        const testArtifactPath = join(await context.ensureWorkspace("artifacts"), "test-output.txt");
        const { writeFile } = await import("node:fs/promises");
        await writeFile(testArtifactPath, `${testResult.stdout}\n${testResult.stderr}`, "utf8");
        await context.emitArtifact({
          type: "test.output",
          name: "test-output.txt",
          path: testArtifactPath,
          metadata: { exitCode: testResult.exitCode },
        });
        if (testResult.exitCode !== 0) {
          throw new Error(`test command failed with exit code ${testResult.exitCode}`);
        }
      }
    },
  };
}

export { captureGitDiff, createTaskBranch, defaultTaskBranchName, repoPath };
