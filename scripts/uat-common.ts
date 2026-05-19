import { spawn, type ChildProcess } from "node:child_process";
import { loadLocalEnv } from "../packages/core/src/env.js";
import { workplaneFetch } from "../packages/core/src/http-client.js";

loadLocalEnv();

export interface TaskRecord {
  id: string;
  status: "queued" | "assigned" | "running" | "succeeded" | "failed" | "cancelled";
}

export interface UatEnv {
  serverUrl: string;
  nodeToken: string;
  operatorToken: string;
  timeoutMs: number;
}

export function ensureUatAuthEnv(): UatEnv {
  const serverUrl = process.env.WORKPLANE_SERVER_URL ?? "http://localhost:8787";
  const nodeToken = process.env.WORKPLANE_NODE_TOKEN ?? "dev-node-token";
  const operatorToken = process.env.WORKPLANE_OPERATOR_TOKEN ?? "dev-operator-token";
  const timeoutRaw = process.env.UAT_TIMEOUT_MS ?? "120000";
  const timeoutMs = Number.parseInt(timeoutRaw, 10);

  process.env.WORKPLANE_NODE_TOKEN = nodeToken;
  process.env.WORKPLANE_OPERATOR_TOKEN = operatorToken;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid UAT_TIMEOUT_MS: ${timeoutRaw}`);
  }

  return { serverUrl, nodeToken, operatorToken, timeoutMs };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForHealth(serverUrl: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await workplaneFetch<{ ok: boolean }>(serverUrl, "/healthz");
      return;
    } catch {
      await delay(500);
    }
  }
  throw new Error(`Server did not become healthy within ${timeoutMs}ms`);
}

export async function waitForTaskCompletion(
  env: UatEnv,
  taskId: string,
): Promise<TaskRecord> {
  const terminal = new Set(["succeeded", "failed", "cancelled"]);
  const start = Date.now();
  while (Date.now() - start < env.timeoutMs) {
    const task = await workplaneFetch<TaskRecord>(env.serverUrl, `/tasks/${taskId}`);
    process.stdout.write(`task ${task.id} status=${task.status}\n`);
    if (terminal.has(task.status)) {
      return task;
    }
    await delay(1000);
  }
  throw new Error(`Task ${taskId} did not reach terminal status in ${env.timeoutMs}ms`);
}

export function spawnManaged(
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  label: string,
): ChildProcess {
  const child = spawn(cmd, args, {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (chunk) => {
    process.stdout.write(`[${label}] ${chunk.toString()}`);
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(`[${label}] ${chunk.toString()}`);
  });

  child.on("exit", (code, signal) => {
    process.stdout.write(`[${label}] exited code=${code ?? "null"} signal=${signal ?? "null"}\n`);
  });

  return child;
}

export async function runChecked(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { env, stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed: ${cmd} ${args.join(" ")} (exit ${code ?? "null"})`));
    });
    child.on("error", reject);
  });
}

export function stopChild(child: ChildProcess | undefined): void {
  if (!child || child.killed) {
    return;
  }
  child.kill("SIGTERM");
}

export async function commandExists(command: string): Promise<boolean> {
  const result = await new Promise<number>((resolve) => {
    const child = spawn("sh", ["-lc", `command -v ${command} >/dev/null 2>&1`], { stdio: "ignore" });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
  return result === 0;
}

export async function submitTask(
  env: UatEnv,
  body: Record<string, unknown>,
): Promise<TaskRecord> {
  return workplaneFetch<TaskRecord>(env.serverUrl, "/tasks", {
    method: "POST",
    body,
    operatorToken: env.operatorToken,
  });
}

export async function printRunSummary(env: UatEnv, taskId: string, completed: TaskRecord): Promise<void> {
  const runs = await workplaneFetch<{ runs: Array<{ id: string }> }>(
    env.serverUrl,
    `/runs?taskId=${encodeURIComponent(taskId)}`,
  );
  const runId = runs.runs[0]?.id;
  if (!runId) {
    throw new Error(`No run found for task ${taskId}`);
  }

  const logs = await workplaneFetch<{ logs: unknown[] }>(env.serverUrl, `/runs/${runId}/logs`);
  const artifacts = await workplaneFetch<{ artifacts: unknown[] }>(env.serverUrl, `/runs/${runId}/artifacts`);

  process.stdout.write(`\nUAT Summary\n`);
  process.stdout.write(`taskId: ${taskId}\n`);
  process.stdout.write(`runId: ${runId}\n`);
  process.stdout.write(`status: ${completed.status}\n`);
  process.stdout.write(`logs: ${logs.logs.length}\n`);
  process.stdout.write(`artifacts: ${artifacts.artifacts.length}\n`);

  if (completed.status !== "succeeded") {
    throw new Error(`UAT failed with task status ${completed.status}`);
  }
}

export async function runUatWithServices(run: (env: UatEnv) => Promise<void>): Promise<void> {
  const env = ensureUatAuthEnv();
  const childEnv = { ...process.env };

  let server: ChildProcess | undefined;
  let node: ChildProcess | undefined;

  try {
    process.stdout.write("Applying database migrations...\n");
    await runChecked("pnpm", ["db:migrate"], childEnv);

    process.stdout.write("Starting server...\n");
    server = spawnManaged("pnpm", ["dev:server"], childEnv, "server");
    await waitForHealth(env.serverUrl, env.timeoutMs);

    process.stdout.write("Starting node...\n");
    node = spawnManaged("pnpm", ["dev:node"], childEnv, "node");
    await delay(1000);

    await run(env);
  } finally {
    stopChild(node);
    stopChild(server);
  }
}
