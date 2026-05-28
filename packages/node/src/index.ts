import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadNodeConfig, loadServerConfig } from "../../core/src/config.js";
import { workplaneFetch } from "../../core/src/http-client.js";
import { defaultTaskBranchName, repoPath } from "../../core/src/git.js";
import { createCancellableExec, ensureWorkspacePath, type WorkAdapter, type WorkContext } from "../../adapter-sdk/src/index.js";
import { createPtyExec } from "./pty-exec.js";
import { shellAdapter } from "../../adapter-shell/src/index.js";
import { aiderAdapter } from "../../adapter-aider/src/index.js";
import { ollamaAdapter } from "../../adapter-ollama/src/index.js";
import { codexAdapter } from "../../adapter-codex/src/index.js";
import { claudeCodeAdapter } from "../../adapter-claude-code/src/index.js";
import type { ArtifactInput, RunInputEvent, RunStatus, TaskRecord } from "../../types/src/index.js";

interface Assignment {
  task: TaskRecord;
  run: {
    id: string;
    taskId: string;
  };
}

const REPO_ADAPTERS = new Set(["aider", "codex", "claude-code"]);

const adapters = new Map<string, WorkAdapter<unknown>>([
  ["shell", shellAdapter as WorkAdapter<unknown>],
  ["aider", aiderAdapter as WorkAdapter<unknown>],
  ["ollama", ollamaAdapter as WorkAdapter<unknown>],
  ["codex", codexAdapter as WorkAdapter<unknown>],
  ["claude-code", claudeCodeAdapter as WorkAdapter<unknown>],
]);

function nowStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function workspaceRoot(): string {
  return resolve(process.env.WORKPLANE_WORKSPACE_ROOT ?? ".workplane/workspaces");
}

function shouldMirrorNodeLogs(): boolean {
  const value = process.env.WORKPLANE_NODE_LOG_MIRROR;
  if (!value) {
    return false;
  }
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

function stringPayloadValue(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function nodeHttpOptions(config: ReturnType<typeof loadNodeConfig>) {
  return { nodeToken: config.nodeToken };
}

async function updateStatus(
  config: ReturnType<typeof loadNodeConfig>,
  runId: string,
  status: RunStatus,
  error?: string,
): Promise<void> {
  await workplaneFetch(config.serverUrl, `/runs/${runId}/status`, {
    method: "POST",
    body: { status, error },
    ...nodeHttpOptions(config),
  });
}

async function appendLogs(
  config: ReturnType<typeof loadNodeConfig>,
  runId: string,
  logs: Array<{ stream: "stdout" | "stderr" | "system"; message: string; stepName?: string }>,
): Promise<void> {
  await workplaneFetch(config.serverUrl, `/runs/${runId}/logs`, {
    method: "POST",
    body: { logs },
    ...nodeHttpOptions(config),
  });
}

async function emitArtifact(
  config: ReturnType<typeof loadNodeConfig>,
  runId: string,
  artifact: ArtifactInput,
): Promise<void> {
  await workplaneFetch(config.serverUrl, `/runs/${runId}/artifacts`, {
    method: "POST",
    body: artifact,
    ...nodeHttpOptions(config),
  });
}

async function pollInputEvents(
  config: ReturnType<typeof loadNodeConfig>,
  runId: string,
  afterSequence: number,
): Promise<RunInputEvent[]> {
  const result = await workplaneFetch<{ events: RunInputEvent[] }>(
    config.serverUrl,
    `/runs/${runId}/input?afterSequence=${afterSequence}`,
    nodeHttpOptions(config),
  );
  return result.events;
}

async function markDelivered(
  config: ReturnType<typeof loadNodeConfig>,
  runId: string,
  sequence: number,
): Promise<void> {
  await workplaneFetch(config.serverUrl, `/runs/${runId}/input/${sequence}/delivered`, {
    method: "POST",
    ...nodeHttpOptions(config),
  });
}

async function isCancelled(config: ReturnType<typeof loadNodeConfig>, runId: string): Promise<boolean> {
  const run = await workplaneFetch<{ status: string; taskId: string }>(config.serverUrl, `/runs/${runId}`, nodeHttpOptions(config));
  if (run.status === "cancelled") {
    return true;
  }
  const task = await workplaneFetch<{ status: string }>(
    config.serverUrl,
    `/tasks/${run.taskId}`,
    nodeHttpOptions(config),
  );
  return task.status === "cancelled";
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
      cwd: repoPath(context.workspacePath),
    });
    if (checkoutResult.exitCode !== 0) {
      throw new Error(`git checkout failed with exit code ${checkoutResult.exitCode}`);
    }
  }

  await context.emitArtifact({
    type: "workspace.repo",
    name: "repo-checkout",
    path: repoPath(context.workspacePath),
    metadata: { repo, branch: branch ?? null },
  });
  return true;
}

async function executeAssignment(config: ReturnType<typeof loadNodeConfig>, assignment: Assignment): Promise<void> {
  const runId = assignment.run.id;
  const task = assignment.task;
  const adapter = adapters.get(task.adapter);
  if (!adapter) {
    await updateStatus(config, runId, "failed", `adapter not registered: ${task.adapter}`);
    return;
  }

  const runWorkspace = join(workspaceRoot(), `${runId}_${nowStamp()}`);
  const mirrorLogs = shouldMirrorNodeLogs();
  await mkdir(runWorkspace, { recursive: true });
  await ensureWorkspacePath(runWorkspace, "logs");
  await ensureWorkspacePath(runWorkspace, "artifacts");
  await ensureWorkspacePath(runWorkspace, "tmp");
  await writeFile(
    join(runWorkspace, "metadata.json"),
    JSON.stringify({ runId, taskId: task.id, adapter: task.adapter, createdAt: new Date().toISOString() }, null, 2),
    "utf8",
  );

  await updateStatus(config, runId, "running");

  const serverEnvAllowlist =
    config.envAllowlist.length > 0
      ? config.envAllowlist
      : loadServerConfig().envAllowlist.length > 0
        ? loadServerConfig().envAllowlist
        : undefined;

  const logFn = async (stream: "stdout" | "stderr" | "system", message: string, stepName?: string): Promise<void> => {
    if (mirrorLogs) {
      const prefix = `[run:${runId}] [${stream}]${stepName ? ` [${stepName}]` : ""} `;
      if (stream === "stderr") {
        process.stderr.write(`${prefix}${message}`);
      } else {
        process.stdout.write(`${prefix}${message}`);
      }
    }
    await appendLogs(config, runId, [{ stream, message, stepName }]);
  };

  const usePty = adapter.terminalMode === "pty";

  const stubContext: WorkContext = {
    runId,
    taskId: task.id,
    workspacePath: runWorkspace,
    log: logFn,
    exec: async () => ({ exitCode: 1, stdout: "", stderr: "not initialized" }),
    ensureWorkspace: async (...segments: string[]) => ensureWorkspacePath(runWorkspace, ...segments),
    emitArtifact: async () => {},
    envAllowlist: serverEnvAllowlist,
  };

  const handle = usePty
    ? createPtyExec(stubContext)
    : createCancellableExec(stubContext);

  const { exec, kill, writeStdin } = handle;
  const ptyResize = "ptyResize" in handle ? handle.ptyResize : undefined;

  const context: WorkContext = {
    runId,
    taskId: task.id,
    workspacePath: runWorkspace,
    envAllowlist: serverEnvAllowlist,
    log: logFn,
    exec,
    ensureWorkspace: async (...segments: string[]) => ensureWorkspacePath(runWorkspace, ...segments),
    emitArtifact: async (input) => {
      await emitArtifact(config, runId, input);
    },
    writeStdin: adapter.interactive ? writeStdin : undefined,
    ptyResize: adapter.interactive ? ptyResize : undefined,
  };

  const cancelInterval = setInterval(() => {
    void isCancelled(config, runId).then((cancelled) => {
      if (cancelled) {
        kill();
      }
    });
  }, 2000);

  let lastInputSequence = 0;
  let inputInterval: ReturnType<typeof setInterval> | undefined;

  if (adapter.interactive) {
    inputInterval = setInterval(() => {
      void pollInputEvents(config, runId, lastInputSequence)
        .then(async (events) => {
          for (const event of events) {
            if (event.kind === "stdin") {
              writeStdin(String(event.payload.data ?? ""));
            } else if (event.kind === "signal") {
              kill(String(event.payload.signal ?? "SIGTERM") as NodeJS.Signals);
            } else if (event.kind === "resize" && ptyResize) {
              const rows = Number(event.payload.rows ?? 50);
              const cols = Number(event.payload.cols ?? 220);
              ptyResize(rows, cols);
            }
            await markDelivered(config, runId, event.sequence);
            lastInputSequence = Math.max(lastInputSequence, event.sequence);
          }
        })
        .catch((err: unknown) => {
          process.stderr.write(`input poll error [run:${runId}]: ${String(err)}\n`);
        });
    }, 500);
  }

  try {
    await context.log("system", `starting adapter ${adapter.name}`, "run-adapter");
    const hasRepo = await checkoutRepoIfPresent(context, task.payload);
    if (REPO_ADAPTERS.has(adapter.name) && !hasRepo) {
      throw new Error(`${adapter.name} adapter requires payload.repo`);
    }

    const adapterPayload = { ...task.payload };
    if (adapter.name === "shell" && hasRepo && typeof adapterPayload.cwd !== "string") {
      adapterPayload.cwd = "repo";
    }

    if (REPO_ADAPTERS.has(adapter.name) && adapter.name !== "aider" && !stringPayloadValue(adapterPayload, "taskBranch")) {
      adapterPayload.taskBranch = defaultTaskBranchName(runId);
    }

    await adapter.run(context, adapterPayload);

    if (await isCancelled(config, runId)) {
      await context.log("system", "run cancelled", "run-adapter");
      await updateStatus(config, runId, "cancelled", "task cancelled");
      return;
    }

    await context.log("system", "adapter execution finished", "run-adapter");
    await updateStatus(config, runId, "succeeded");
  } catch (error) {
    if (await isCancelled(config, runId)) {
      await updateStatus(config, runId, "cancelled", "task cancelled");
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    await context.log("stderr", message, "run-adapter");
    await updateStatus(config, runId, "failed", message);
  } finally {
    clearInterval(cancelInterval);
    if (inputInterval !== undefined) {
      clearInterval(inputInterval);
    }
    kill();
  }
}

async function main(): Promise<void> {
  const config = loadNodeConfig();
  const register = await workplaneFetch<{ id: string }>(config.serverUrl, "/nodes/register", {
    method: "POST",
    body: {
      name: config.nodeName,
      capabilities: config.nodeCapabilities,
      nodeId: config.nodeId,
    },
    ...nodeHttpOptions(config),
  });
  const nodeId = register.id;
  process.stdout.write(`node registered: ${nodeId}\n`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const poll = await workplaneFetch<{ assignment: Assignment | null }>(
        config.serverUrl,
        `/nodes/${nodeId}/poll`,
        {
          method: "POST",
          body: {
            capabilities: config.nodeCapabilities,
          },
          ...nodeHttpOptions(config),
        },
      );

      if (poll.assignment) {
        await executeAssignment(config, poll.assignment);
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
