import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadNodeConfig } from "../../core/src/config.js";
import { createExec, ensureWorkspacePath, type WorkAdapter, type WorkContext } from "../../adapter-sdk/src/index.js";
import { shellAdapter } from "../../adapter-shell/src/index.js";
import { aiderAdapter } from "../../adapter-aider/src/index.js";
import type { ArtifactInput, RunStatus, TaskRecord } from "../../types/src/index.js";

interface Assignment {
  task: TaskRecord;
  run: {
    id: string;
    taskId: string;
  };
}

const adapters = new Map<string, WorkAdapter<unknown>>([
  ["shell", shellAdapter as WorkAdapter<unknown>],
  ["aider", aiderAdapter as WorkAdapter<unknown>],
]);

async function httpJson<T>(
  url: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const response = await fetch(url, {
    method: options?.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} from ${url}`);
  }

  return (await response.json()) as T;
}

function nowStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function workspaceRoot(): string {
  return resolve(process.env.WORKPLANE_WORKSPACE_ROOT ?? ".workplane/workspaces");
}

async function updateStatus(serverUrl: string, runId: string, status: RunStatus, error?: string): Promise<void> {
  await httpJson(`${serverUrl}/runs/${runId}/status`, {
    method: "POST",
    body: { status, error },
  });
}

async function appendLogs(
  serverUrl: string,
  runId: string,
  logs: Array<{ stream: "stdout" | "stderr" | "system"; message: string; stepName?: string }>,
): Promise<void> {
  await httpJson(`${serverUrl}/runs/${runId}/logs`, {
    method: "POST",
    body: { logs },
  });
}

async function emitArtifact(serverUrl: string, runId: string, artifact: ArtifactInput): Promise<void> {
  await httpJson(`${serverUrl}/runs/${runId}/artifacts`, {
    method: "POST",
    body: artifact,
  });
}

function stringPayloadValue(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function checkoutRepoIfPresent(context: WorkContext, payload: Record<string, unknown>): Promise<boolean> {
  const repo = stringPayloadValue(payload, "repo");
  if (!repo) {
    return false;
  }

  await context.log("system", `cloning repository ${repo}`, "checkout-repo");
  const cloneResult = await context.exec("git", ["clone", repo, "repo"], {
    cwd: context.workspacePath,
  });
  if (cloneResult.exitCode !== 0) {
    throw new Error(`git clone failed with exit code ${cloneResult.exitCode}`);
  }

  const branch = stringPayloadValue(payload, "branch");
  if (branch) {
    await context.log("system", `checking out branch ${branch}`, "checkout-repo");
    const checkoutResult = await context.exec("git", ["checkout", branch], {
      cwd: join(context.workspacePath, "repo"),
    });
    if (checkoutResult.exitCode !== 0) {
      throw new Error(`git checkout failed with exit code ${checkoutResult.exitCode}`);
    }
  }

  await context.emitArtifact({
    type: "workspace.repo",
    name: "repo-checkout",
    path: join(context.workspacePath, "repo"),
    metadata: { repo, branch: branch ?? null },
  });
  return true;
}

async function executeAssignment(serverUrl: string, assignment: Assignment): Promise<void> {
  const runId = assignment.run.id;
  const task = assignment.task;
  const adapter = adapters.get(task.adapter);
  if (!adapter) {
    await updateStatus(serverUrl, runId, "failed", `adapter not registered: ${task.adapter}`);
    return;
  }

  const runWorkspace = join(workspaceRoot(), `${runId}_${nowStamp()}`);
  await mkdir(runWorkspace, { recursive: true });
  await ensureWorkspacePath(runWorkspace, "logs");
  await ensureWorkspacePath(runWorkspace, "artifacts");
  await ensureWorkspacePath(runWorkspace, "tmp");
  await writeFile(
    join(runWorkspace, "metadata.json"),
    JSON.stringify({ runId, taskId: task.id, adapter: task.adapter, createdAt: new Date().toISOString() }, null, 2),
    "utf8",
  );

  await updateStatus(serverUrl, runId, "running");

  const context: WorkContext = {
    runId,
    taskId: task.id,
    workspacePath: runWorkspace,
    log: async (stream, message, stepName) => {
      await appendLogs(serverUrl, runId, [{ stream, message, stepName }]);
    },
    exec: async () => ({ exitCode: 1, stdout: "", stderr: "not initialized" }),
    ensureWorkspace: async (...segments: string[]) => ensureWorkspacePath(runWorkspace, ...segments),
    emitArtifact: async (input) => {
      await emitArtifact(serverUrl, runId, input);
    },
  };
  context.exec = createExec(context);

  try {
    await context.log("system", `starting adapter ${adapter.name}`, "run-adapter");
    const hasRepo = await checkoutRepoIfPresent(context, task.payload);
    if (adapter.name === "aider" && !hasRepo) {
      throw new Error("aider adapter requires payload.repo");
    }
    const adapterPayload = { ...task.payload };
    if (adapter.name === "shell" && hasRepo && typeof adapterPayload.cwd !== "string") {
      adapterPayload.cwd = "repo";
    }
    await adapter.run(context, adapterPayload);
    await context.log("system", "adapter execution finished", "run-adapter");
    await updateStatus(serverUrl, runId, "succeeded");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await context.log("stderr", message, "run-adapter");
    await updateStatus(serverUrl, runId, "failed", message);
  }
}

async function main(): Promise<void> {
  const config = loadNodeConfig();
  const register = await httpJson<{ id: string }>(`${config.serverUrl}/nodes/register`, {
    method: "POST",
    body: {
      name: config.nodeName,
      capabilities: config.nodeCapabilities,
    },
  });
  const nodeId = register.id;
  process.stdout.write(`node registered: ${nodeId}\n`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const poll = await httpJson<{ assignment: Assignment | null }>(`${config.serverUrl}/nodes/${nodeId}/poll`, {
        method: "POST",
        body: {
          capabilities: config.nodeCapabilities,
        },
      });

      if (poll.assignment) {
        await executeAssignment(config.serverUrl, poll.assignment);
      }
    } catch (error) {
      process.stderr.write(`poll error: ${String(error)}\n`);
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, config.pollIntervalMs));
  }
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
