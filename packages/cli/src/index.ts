import { loadLocalEnv } from "../../core/src/env.js";
import { parseCsv } from "../../core/src/config.js";
import { workplaneFetch } from "../../core/src/http-client.js";
import { createDefaultRegistry, listSkills } from "../../agent-skills/src/skills/index.js";
import { SequentialWorkplanRunner } from "../../workplans/src/runner.js";
import { LocalWorkplanContext } from "../../workplans/src/context.js";

loadLocalEnv();

const serverUrl = process.env.WORKPLANE_SERVER_URL ?? "http://localhost:8787";
const operatorToken = process.env.WORKPLANE_OPERATOR_TOKEN;

async function httpJson<T>(
  path: string,
  options?: { method?: string; body?: Record<string, unknown>; operator?: boolean },
): Promise<T> {
  return workplaneFetch<T>(serverUrl, path, {
    method: options?.method,
    body: options?.body,
    operatorToken: options?.operator ? operatorToken : undefined,
  });
}

interface RunListResponse {
  runs: Array<{ id: string }>;
}

function valueArg(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function parseInputArgs(args: string[]): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === "--input") {
      const pair = args[i + 1];
      const eqIndex = pair.indexOf("=");
      if (eqIndex === -1) {
        throw new Error("--input must be key=value");
      }
      inputs[pair.slice(0, eqIndex)] = pair.slice(eqIndex + 1);
      i++;
    }
  }
  return inputs;
}

function parseOptionArgs(args: string[]): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i].startsWith("--")) {
      options[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return options;
}

function printJson(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function resolveRunIdFromTaskId(taskId: string): Promise<string> {
  const runs = await httpJson<RunListResponse>(`/runs?taskId=${encodeURIComponent(taskId)}`);
  const runId = runs.runs[0]?.id;
  if (!runId) {
    throw new Error(`no runs found for task ${taskId}`);
  }
  return runId;
}

async function showLogsById(id: string): Promise<void> {
  const runId = id.startsWith("task_") ? await resolveRunIdFromTaskId(id) : id;
  const logs = await httpJson(`/runs/${runId}/logs`);
  printJson(logs);
}

function usage(): void {
  process.stdout.write(
    [
      "workplane CLI",
      "",
      "Env: WORKPLANE_SERVER_URL, WORKPLANE_OPERATOR_TOKEN (for task submit/retry/cancel)",
      "",
      "Commands:",
      "  server start / node start          # use pnpm dev:server / dev:node",
      "  task submit shell --command <cmd> [--repo <url>] [--branch <b>] [--cwd <path>]",
      "  task submit aider --prompt <text> --repo <url> [--model <m>] [--test-command <cmd>]",
      "  task submit inference --model <m> --prompt <text> [--requires ollama]",
      "  task submit harness --harness <codex|claude-code> --repo <url> --prompt <text> [--interactive]",
      "  tasks [--status <status>]",
      "  task show|logs|retry|cancel <taskId>",
      "  runs [--task-id <id>] [--status <status>]",
      "  run show <runId>",
      "  run input <runId> --stdin <text>",
      "  run input <runId> --signal <SIGTERM|SIGKILL|SIGINT>",
      "  run input <runId> --resize <COLSxROWS>",
      "  logs <runId|taskId>",
      "  artifacts <runId>",
      "  skill list",
      "  skill run <name> [--key value ...]",
      "  schedule create <planId> --cron <expr> --timezone <tz> [--name <label>] [--input key=value ...] [--disabled]",
      "  schedule list [--enabled]",
      "  schedule show <scheduleId>",
      "  schedule enable|disable|delete|run <scheduleId>",
      "  schedule tick",
      "  workplan-runs [--schedule-id <id>]",
      "  workplan-run show <runId>",
      "  workplan-run steps <runId>",
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
    operator: true,
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
  const testCommand = valueArg(args, "--test-command");
  const requires = parseCsv(valueArg(args, "--requires") ?? "git,aider");
  const task = await httpJson("/tasks", {
    method: "POST",
    operator: true,
    body: {
      kind: "agent.run",
      adapter: "aider",
      requires,
      payload: { prompt, model, repo, branch, testCommand },
    },
  });

  printJson(task);
}

async function submitInference(args: string[]): Promise<void> {
  const model = valueArg(args, "--model");
  const prompt = valueArg(args, "--prompt");
  if (!model || !prompt) {
    throw new Error("--model and --prompt are required");
  }

  const adapter = valueArg(args, "--adapter") ?? "ollama";
  const requires = parseCsv(valueArg(args, "--requires") ?? adapter);
  const inputFile = valueArg(args, "--input-file");

  const task = await httpJson("/tasks", {
    method: "POST",
    operator: true,
    body: {
      kind: "inference.batch",
      adapter,
      requires,
      payload: { model, prompt, inputFile },
    },
  });

  printJson(task);
}

async function submitHarness(args: string[]): Promise<void> {
  const harness = valueArg(args, "--harness");
  const prompt = valueArg(args, "--prompt");
  const repo = valueArg(args, "--repo");
  if (!harness || !prompt || !repo) {
    throw new Error("--harness, --prompt, and --repo are required");
  }

  if (harness !== "codex" && harness !== "claude-code") {
    throw new Error("--harness must be codex or claude-code");
  }

  const model = valueArg(args, "--model");
  const branch = valueArg(args, "--branch");
  const testCommand = valueArg(args, "--test-command");
  const interactive = args.includes("--interactive") || undefined;
  const requires = parseCsv(valueArg(args, "--requires") ?? `${harness},git`);

  const task = await httpJson("/tasks", {
    method: "POST",
    operator: true,
    body: {
      kind: "agent.run",
      adapter: harness,
      requires,
      payload: { prompt, repo, model, branch, testCommand, interactive },
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
    if (adapter === "inference") {
      await submitInference(adapterArgs);
      return;
    }
    if (adapter === "harness") {
      await submitHarness(adapterArgs);
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
    const task = await httpJson(`/tasks/${taskId}/retry`, { method: "POST", operator: true });
    printJson(task);
    return;
  }

  if (command === "task" && subcommand === "logs") {
    const taskId = rest[0];
    if (!taskId) {
      throw new Error("task id is required");
    }
    await showLogsById(taskId);
    return;
  }

  if (command === "task" && subcommand === "cancel") {
    const taskId = rest[0];
    if (!taskId) {
      throw new Error("task id is required");
    }
    const task = await httpJson(`/tasks/${taskId}/cancel`, { method: "POST", operator: true });
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

  if (command === "run" && subcommand === "input") {
    const runId = rest[0];
    if (!runId) {
      throw new Error("run id is required");
    }
    const inputArgs = rest.slice(1);
    const stdinData = valueArg(inputArgs, "--stdin");
    const signal = valueArg(inputArgs, "--signal");
    const resize = valueArg(inputArgs, "--resize");

    let body: Record<string, unknown>;
    if (stdinData !== undefined) {
      body = { kind: "stdin", payload: { data: stdinData } };
    } else if (signal !== undefined) {
      if (signal !== "SIGTERM" && signal !== "SIGKILL" && signal !== "SIGINT") {
        throw new Error("--signal must be SIGTERM, SIGKILL, or SIGINT");
      }
      body = { kind: "signal", payload: { signal } };
    } else if (resize !== undefined) {
      const match = /^(\d+)x(\d+)$/.exec(resize);
      if (!match) {
        throw new Error("--resize must be in COLSxROWS format, e.g. 220x50");
      }
      body = { kind: "resize", payload: { cols: Number(match[1]), rows: Number(match[2]) } };
    } else {
      throw new Error("one of --stdin, --signal, or --resize is required");
    }

    const result = await httpJson(`/runs/${runId}/input`, { method: "POST", operator: true, body });
    printJson(result);
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
    const id = subcommand;
    if (!id) {
      throw new Error("run id or task id is required");
    }
    await showLogsById(id);
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

  if (command === "skill" && subcommand === "list") {
    const registry = createDefaultRegistry();
    process.stdout.write("Available skills:\n");
    listSkills(registry);
    return;
  }

  if (command === "skill" && subcommand === "run") {
    const skillName = rest[0];
    if (!skillName) {
      throw new Error("skill name is required");
    }
    const registry = createDefaultRegistry();
    const skill = registry.get(skillName);
    if (!skill) {
      throw new Error(`unknown skill: ${skillName}. Run 'workplane skill list' to see available skills.`);
    }

    const optArgs = rest.slice(1);
    const options = parseOptionArgs(optArgs);

    const plan = skill.buildPlan(options);
    const runner = new SequentialWorkplanRunner();
    const ctx = new LocalWorkplanContext();
    const result = await runner.run(plan, ctx);

    if (!result.succeeded) {
      process.stderr.write(`skill '${skillName}' failed at step '${result.steps.at(-1)?.stepId ?? "unknown"}'\n`);
      process.exit(1);
    }
    return;
  }

  if (command === "schedule" && subcommand === "create") {
    const planId = rest[0];
    if (!planId) {
      throw new Error("plan id is required");
    }
    const createArgs = rest.slice(1);
    const cronExpression = valueArg(createArgs, "--cron");
    const timezone = valueArg(createArgs, "--timezone");
    if (!cronExpression || !timezone) {
      throw new Error("--cron and --timezone are required");
    }
    const schedule = await httpJson("/schedules", {
      method: "POST",
      operator: true,
      body: {
        planId,
        name: valueArg(createArgs, "--name") ?? planId,
        cronExpression,
        timezone,
        inputs: parseInputArgs(createArgs),
        enabled: !createArgs.includes("--disabled"),
      },
    });
    printJson(schedule);
    return;
  }

  if (command === "schedule" && subcommand === "list") {
    const enabled = valueArg(rest, "--enabled");
    const path = enabled ? `/schedules?enabled=${encodeURIComponent(enabled)}` : "/schedules";
    const schedules = await httpJson(path);
    printJson(schedules);
    return;
  }

  if (command === "schedule" && subcommand === "show") {
    const scheduleId = rest[0];
    if (!scheduleId) {
      throw new Error("schedule id is required");
    }
    const schedule = await httpJson(`/schedules/${scheduleId}`);
    printJson(schedule);
    return;
  }

  if (command === "schedule" && (subcommand === "enable" || subcommand === "disable")) {
    const scheduleId = rest[0];
    if (!scheduleId) {
      throw new Error("schedule id is required");
    }
    const schedule = await httpJson(`/schedules/${scheduleId}`, {
      method: "PATCH",
      operator: true,
      body: { enabled: subcommand === "enable" },
    });
    printJson(schedule);
    return;
  }

  if (command === "schedule" && subcommand === "delete") {
    const scheduleId = rest[0];
    if (!scheduleId) {
      throw new Error("schedule id is required");
    }
    const result = await httpJson(`/schedules/${scheduleId}`, { method: "DELETE", operator: true });
    printJson(result);
    return;
  }

  if (command === "schedule" && subcommand === "run") {
    const scheduleId = rest[0];
    if (!scheduleId) {
      throw new Error("schedule id is required");
    }
    const run = await httpJson(`/schedules/${scheduleId}/run`, { method: "POST", operator: true });
    printJson(run);
    return;
  }

  if (command === "schedule" && subcommand === "tick") {
    const result = await httpJson("/schedules/tick", { method: "POST", operator: true });
    printJson(result);
    return;
  }

  if (command === "workplan-runs") {
    const scheduleId = valueArg([subcommand, ...rest].filter(Boolean) as string[], "--schedule-id");
    const path = scheduleId
      ? `/workplan-runs?scheduleId=${encodeURIComponent(scheduleId)}`
      : "/workplan-runs";
    const runs = await httpJson(path);
    printJson(runs);
    return;
  }

  if (command === "workplan-run" && subcommand === "show") {
    const runId = rest[0];
    if (!runId) {
      throw new Error("workplan run id is required");
    }
    const run = await httpJson(`/workplan-runs/${runId}`);
    printJson(run);
    return;
  }

  if (command === "workplan-run" && subcommand === "steps") {
    const runId = rest[0];
    if (!runId) {
      throw new Error("workplan run id is required");
    }
    const steps = await httpJson(`/workplan-runs/${runId}/steps`);
    printJson(steps);
    return;
  }

  usage();
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
