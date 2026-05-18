import { parseCsv } from "../../core/src/config.js";

const serverUrl = process.env.WORKPLANE_SERVER_URL ?? "http://localhost:8787";

async function httpJson<T>(
  path: string,
  options?: { method?: string; body?: Record<string, unknown> },
): Promise<T> {
  const response = await fetch(`${serverUrl}${path}`, {
    method: options?.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  return (await response.json()) as T;
}

function valueArg(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function printJson(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function usage(): void {
  process.stdout.write(
    [
      "workplane local CLI",
      "",
      "Commands:",
      "  server start                           # alias helper",
      "  node start                             # alias helper",
      "  task submit shell --command <cmd>",
      "                   [--repo <url>] [--branch <branch>] [--cwd <path>]",
      "  task submit aider --prompt <text> [--model <model>]",
      "                   --repo <url> [--branch <branch>]",
      "  tasks",
      "       [--status <queued|assigned|running|succeeded|failed|cancelled>]",
      "  task show <taskId>",
      "  task retry <taskId>",
      "  task cancel <taskId>",
      "  runs [--task-id <taskId>]",
      "       [--status <queued|assigned|running|succeeded|failed|cancelled>]",
      "  run show <runId>",
      "  logs <runId>",
      "  artifacts <runId>",
    ].join("\n"),
  );
}

async function submitShell(args: string[]): Promise<void> {
  const command = valueArg(args, "--command");
  if (!command) {
    throw new Error("--command is required");
  }

  const requires = parseCsv(valueArg(args, "--requires") ?? "shell");
  const repo = valueArg(args, "--repo");
  const branch = valueArg(args, "--branch");
  const cwd = valueArg(args, "--cwd");
  const task = await httpJson("/tasks", {
    method: "POST",
    body: {
      kind: "shell.exec",
      adapter: "shell",
      requires,
      payload: { command, repo, branch, cwd },
    },
  });

  printJson(task);
}

async function submitAider(args: string[]): Promise<void> {
  const prompt = valueArg(args, "--prompt");
  if (!prompt) {
    throw new Error("--prompt is required");
  }

  const model = valueArg(args, "--model");
  const repo = valueArg(args, "--repo");
  if (!repo) {
    throw new Error("--repo is required");
  }
  const branch = valueArg(args, "--branch");
  const requires = parseCsv(valueArg(args, "--requires") ?? "git,aider");
  const task = await httpJson("/tasks", {
    method: "POST",
    body: {
      kind: "agent.run",
      adapter: "aider",
      requires,
      payload: { prompt, model, repo, branch },
    },
  });

  printJson(task);
}

async function main(): Promise<void> {
  const [command, subcommand, ...rest] = process.argv.slice(2);

  if (!command) {
    usage();
    return;
  }

  if (command === "server" && subcommand === "start") {
    process.stdout.write("Use: pnpm dev:server\n");
    return;
  }

  if (command === "node" && subcommand === "start") {
    process.stdout.write("Use: pnpm dev:node\n");
    return;
  }

  if (command === "task" && subcommand === "submit") {
    const adapter = rest[0];
    const adapterArgs = rest.slice(1);
    if (adapter === "shell") {
      await submitShell(adapterArgs);
      return;
    }
    if (adapter === "aider") {
      await submitAider(adapterArgs);
      return;
    }
    throw new Error(`unsupported adapter submit: ${adapter}`);
  }

  if (command === "tasks") {
    const status = valueArg([subcommand, ...rest].filter(Boolean) as string[], "--status");
    const tasks = await httpJson(status ? `/tasks?status=${encodeURIComponent(status)}` : "/tasks");
    printJson(tasks);
    return;
  }

  if (command === "task" && subcommand === "show") {
    const taskId = rest[0];
    if (!taskId) {
      throw new Error("task id is required");
    }
    const task = await httpJson(`/tasks/${taskId}`);
    printJson(task);
    return;
  }

  if (command === "task" && subcommand === "retry") {
    const taskId = rest[0];
    if (!taskId) {
      throw new Error("task id is required");
    }
    const task = await httpJson(`/tasks/${taskId}/retry`, { method: "POST" });
    printJson(task);
    return;
  }

  if (command === "task" && subcommand === "cancel") {
    const taskId = rest[0];
    if (!taskId) {
      throw new Error("task id is required");
    }
    const task = await httpJson(`/tasks/${taskId}/cancel`, { method: "POST" });
    printJson(task);
    return;
  }

  if (command === "runs") {
    const taskId = valueArg(rest, "--task-id");
    const status = valueArg(rest, "--status");
    const query = new URLSearchParams();
    if (taskId) {
      query.set("taskId", taskId);
    }
    if (status) {
      query.set("status", status);
    }
    const runs = await httpJson(query.size > 0 ? `/runs?${query.toString()}` : "/runs");
    printJson(runs);
    return;
  }

  if (command === "run" && subcommand === "show") {
    const runId = rest[0];
    if (!runId) {
      throw new Error("run id is required");
    }
    const run = await httpJson(`/runs/${runId}`);
    printJson(run);
    return;
  }

  if (command === "logs") {
    const runId = subcommand;
    if (!runId) {
      throw new Error("run id is required");
    }
    const logs = await httpJson(`/runs/${runId}/logs`);
    printJson(logs);
    return;
  }

  if (command === "artifacts") {
    const runId = subcommand;
    if (!runId) {
      throw new Error("run id is required");
    }
    const artifacts = await httpJson(`/runs/${runId}/artifacts`);
    printJson(artifacts);
    return;
  }

  usage();
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
