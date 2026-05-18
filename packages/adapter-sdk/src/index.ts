import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
}

export interface ArtifactInput {
  type: string;
  name: string;
  path: string;
  metadata?: Record<string, unknown>;
}

export interface WorkContext {
  runId: string;
  taskId: string;
  workspacePath: string;
  log: (stream: "stdout" | "stderr" | "system", message: string, stepName?: string) => Promise<void>;
  exec: (command: string, args?: string[], options?: ExecOptions) => Promise<ExecResult>;
  ensureWorkspace: (...segments: string[]) => Promise<string>;
  emitArtifact: (input: ArtifactInput) => Promise<void>;
}

export interface WorkAdapter<TPayload = Record<string, unknown>> {
  name: string;
  kind: string;
  run: (context: WorkContext, payload: TPayload) => Promise<void>;
}

export function createExec(context: WorkContext): WorkContext["exec"] {
  return async (command: string, args: string[] = [], options: ExecOptions = {}) =>
    new Promise<ExecResult>((resolve) => {
      let childError: Error | undefined;
      const child = spawn(command, args, {
        cwd: options.cwd ?? context.workspacePath,
        env: {
          ...process.env,
          ...(options.env ?? {}),
        },
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        const text = chunk.toString();
        stdout += text;
        void context.log("stdout", text);
      });

      child.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        stderr += text;
        void context.log("stderr", text);
      });

      child.on("error", (error) => {
        childError = error;
      });

      child.on("close", (exitCode) => {
        resolve({
          exitCode: exitCode ?? 1,
          stdout,
          stderr: childError ? `${stderr}\n${childError.message}`.trim() : stderr,
        });
      });
    });
}

export async function ensureWorkspacePath(workspacePath: string, ...segments: string[]): Promise<string> {
  const fullPath = join(workspacePath, ...segments);
  await mkdir(fullPath, { recursive: true });
  return fullPath;
}
