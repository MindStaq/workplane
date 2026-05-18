import { spawn, type ChildProcess } from "node:child_process";
import { loadLocalEnv } from "../packages/core/src/env.js";

loadLocalEnv();

interface TaskRecord {
  id: string;
  status: "queued" | "assigned" | "running" | "succeeded" | "failed" | "cancelled";
}

interface RunRecord {
  id: string;
  status: string;
}

interface UatOptions {
  command: string;
  repo?: string;
  branch?: string;
  timeoutMs: number;
  serverUrl: string;
}

function parseArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) {
    return undefined;
  }
  return process.argv[index + 1];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return (await response.json()) as T;
}

async function waitForHealth(serverUrl: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetchJson(`${serverUrl}/healthz`);
      return;
    } catch {
      await delay(500);
    }
  }
  throw new Error(`Server did not become healthy within ${timeoutMs}ms`);
}

async function waitForTaskCompletion(serverUrl: string, taskId: string, timeoutMs: number): Promise<TaskRecord> {
  const terminal = new Set(["succeeded", "failed", "cancelled"]);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const task = await fetchJson<TaskRecord>(`${serverUrl}/tasks/${taskId}`);
    process.stdout.write(`task ${task.id} status=${task.status}\n`);
    if (terminal.has(task.status)) {
      return task;
    }
    await delay(1000);
  }
  throw new Error(`Task ${taskId} did not reach terminal status in ${timeoutMs}ms`);
}

function spawnManaged(cmd: string, args: string[], env: NodeJS.ProcessEnv, label: string): ChildProcess {
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

async function runChecked(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, {
      env,
      stdio: "inherit",
    });
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

function stopChild(child: ChildProcess | undefined): void {
  if (!child || child.killed) {
    return;
  }
  child.kill("SIGTERM");
}

function parseOptions(): UatOptions {
  const command = parseArg("--command") ?? process.env.UAT_SHELL_COMMAND ?? "echo workplane-uat-ok";
  const repo = parseArg("--repo") ?? process.env.UAT_REPO;
  const branch = parseArg("--branch") ?? process.env.UAT_BRANCH;
  const timeoutRaw = parseArg("--timeout-ms") ?? process.env.UAT_TIMEOUT_MS ?? "120000";
  const timeoutMs = Number.parseInt(timeoutRaw, 10);
  const serverUrl = process.env.WORKPLANE_SERVER_URL ?? "http://localhost:8787";
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid timeout value: ${timeoutRaw}`);
  }
  return {
    command,
    repo,
    branch,
    timeoutMs,
    serverUrl,
  };
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const options = parseOptions();
  const env = {
    ...process.env,
    WORKPLANE_SERVER_URL: options.serverUrl,
  };

  let server: ChildProcess | undefined;
  let node: ChildProcess | undefined;

  try {
    process.stdout.write("Applying database migrations...\n");
    await runChecked("pnpm", ["db:migrate"], env);

    process.stdout.write("Starting server...\n");
    server = spawnManaged("pnpm", ["dev:server"], env, "server");
    await waitForHealth(options.serverUrl, options.timeoutMs);

    process.stdout.write("Starting node...\n");
    node = spawnManaged("pnpm", ["dev:node"], env, "node");
    await delay(1000);

    process.stdout.write("Submitting shell UAT task...\n");
    const task = await fetchJson<TaskRecord>(`${options.serverUrl}/tasks`, {
      method: "POST",
      body: JSON.stringify({
        kind: "shell.exec",
        adapter: "shell",
        requires: options.repo ? ["shell", "git"] : ["shell"],
        payload: {
          command: options.command,
          repo: options.repo,
          branch: options.branch,
        },
      }),
    });

    const completed = await waitForTaskCompletion(options.serverUrl, task.id, options.timeoutMs);
    const runs = await fetchJson<{ runs: RunRecord[] }>(
      `${options.serverUrl}/runs?taskId=${encodeURIComponent(task.id)}`,
    );
    const runId = runs.runs[0]?.id;
    if (!runId) {
      throw new Error(`No run found for task ${task.id}`);
    }

    const logs = await fetchJson<{ logs: Array<Record<string, unknown>> }>(`${options.serverUrl}/runs/${runId}/logs`);
    const artifacts = await fetchJson<{ artifacts: Array<Record<string, unknown>> }>(
      `${options.serverUrl}/runs/${runId}/artifacts`,
    );

    process.stdout.write(`\nUAT Summary\n`);
    process.stdout.write(`taskId: ${task.id}\n`);
    process.stdout.write(`runId: ${runId}\n`);
    process.stdout.write(`status: ${completed.status}\n`);
    process.stdout.write(`logs: ${logs.logs.length}\n`);
    process.stdout.write(`artifacts: ${artifacts.artifacts.length}\n`);

    if (completed.status !== "succeeded") {
      throw new Error(`UAT failed with task status ${completed.status}`);
    }
  } finally {
    stopChild(node);
    stopChild(server);
  }
}

main().catch((error) => {
  process.stderr.write(`UAT error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
