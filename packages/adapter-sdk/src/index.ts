import { spawn, type ChildProcess } from "node:child_process";
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
  signal?: AbortSignal;
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
  envAllowlist?: string[];
  writeStdin?: (data: string) => void;
  ptyResize?: (rows: number, cols: number) => void;
}

export interface WorkAdapter<TPayload = Record<string, unknown>> {
  name: string;
  kind: string;
  interactive?: boolean;
  terminalMode?: "stdio" | "pty";
  run: (context: WorkContext, payload: TPayload) => Promise<void>;
}

function pickEnv(allowlist: string[] | undefined): Record<string, string> {
  if (!allowlist || allowlist.length === 0) {
    return { ...process.env } as Record<string, string>;
  }
  const picked: Record<string, string> = {};
  for (const key of allowlist) {
    const value = process.env[key];
    if (value !== undefined) {
      picked[key] = value;
    }
  }
  picked.PATH = process.env.PATH ?? "";
  picked.HOME = process.env.HOME ?? "";
  return picked;
}

export function createExec(context: WorkContext): WorkContext["exec"] {
  return async (command: string, args: string[] = [], options: ExecOptions = {}) =>
    new Promise<ExecResult>((resolve) => {
      let childError: Error | undefined;
      const child = spawn(command, args, {
        cwd: options.cwd ?? context.workspacePath,
        env: {
          ...pickEnv(context.envAllowlist),
          ...(options.env ?? {}),
        },
        signal: options.signal,
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

      child.on("close", (exitCode, signal) => {
        if (signal === "SIGTERM" || signal === "SIGKILL") {
          resolve({
            exitCode: exitCode ?? 1,
            stdout,
            stderr: `${stderr}\nprocess terminated (${signal})`.trim(),
          });
          return;
        }
        resolve({
          exitCode: exitCode ?? 1,
          stdout,
          stderr: childError ? `${stderr}\n${childError.message}`.trim() : stderr,
        });
      });
    });
}

export function createCancellableExec(context: WorkContext): {
  exec: WorkContext["exec"];
  kill: (signal?: NodeJS.Signals) => void;
  writeStdin: (data: string) => void;
} {
  let activeChild: ChildProcess | undefined;

  const exec: WorkContext["exec"] = async (command, args = [], options = {}) =>
    new Promise<ExecResult>((resolve) => {
      let childError: Error | undefined;
      const child = spawn(command, args, {
        cwd: options.cwd ?? context.workspacePath,
        env: {
          ...pickEnv(context.envAllowlist),
          ...(options.env ?? {}),
        },
        signal: options.signal,
      });
      activeChild = child;

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

      child.on("close", (exitCode, signal) => {
        if (activeChild === child) {
          activeChild = undefined;
        }
        if (signal === "SIGTERM" || signal === "SIGKILL") {
          resolve({
            exitCode: exitCode ?? 1,
            stdout,
            stderr: `${stderr}\nprocess terminated (${signal})`.trim(),
          });
          return;
        }
        resolve({
          exitCode: exitCode ?? 1,
          stdout,
          stderr: childError ? `${stderr}\n${childError.message}`.trim() : stderr,
        });
      });
    });

  const kill = (signal: NodeJS.Signals = "SIGTERM"): void => {
    if (activeChild && !activeChild.killed) {
      activeChild.kill(signal);
    }
  };

  const writeStdin = (data: string): void => {
    if (activeChild && !activeChild.killed && activeChild.stdin && !activeChild.stdin.destroyed) {
      activeChild.stdin.write(data);
    }
  };

  return { exec, kill, writeStdin };
}

export async function ensureWorkspacePath(workspacePath: string, ...segments: string[]): Promise<string> {
  const fullPath = join(workspacePath, ...segments);
  await mkdir(fullPath, { recursive: true });
  return fullPath;
}
