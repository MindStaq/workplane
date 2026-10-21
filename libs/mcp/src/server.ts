import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { WorkplaneApiError, WorkplaneClient } from "@workplane/client";
import type { AppendInputEventInput, CreateTaskInput } from "@workplane/types";
import { z } from "zod";

export interface WorkplaneMcpOptions {
  /** Base URL of the control plane, for example `http://localhost:8787`. */
  baseUrl: string;
  /** Operator token used for every API call. */
  token?: string;
  /** Custom `fetch` (tests, proxies). Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Reported to MCP clients as the server version. */
  version?: string;
}

const READ: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
const WRITE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
/** Starts work on fleet machines (shell commands, harness agents against repos). */
const DISPATCH: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
/** Clients should ask a human before calling these. */
const DESTRUCTIVE: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };

const RUN_STATUS = z.enum(["queued", "assigned", "running", "succeeded", "failed", "cancelled"]);

function json(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function failure(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** API errors become tool errors the model can read and recover from, not protocol errors. */
async function call(action: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return json(await action());
  } catch (error) {
    if (error instanceof WorkplaneApiError || error instanceof ToolInputError) {
      return failure(error.message);
    }
    throw error;
  }
}

class ToolInputError extends Error {}

const submitTaskShape = {
  kind: z
    .enum(["shell", "inference", "harness"])
    .describe("shell runs a command, inference sends a prompt to a local model, harness runs a coding agent on a repo"),
  command: z.string().optional().describe("shell: command to run"),
  prompt: z.string().optional().describe("inference / harness: the prompt"),
  model: z.string().optional().describe("inference: model name (required); harness: optional model override"),
  harness: z.enum(["claude-code", "codex"]).optional().describe("harness: which coding agent to run"),
  adapter: z.string().optional().describe("inference: adapter to use (default ollama)"),
  repo: z.string().optional().describe("Git URL to clone (harness: required)"),
  branch: z.string().optional(),
  cwd: z.string().optional().describe("shell: working directory on the node"),
  testCommand: z.string().optional().describe("harness: command that verifies the change"),
  interactive: z.boolean().optional().describe("harness: run in a PTY so send_run_input can steer it"),
  requires: z.array(z.string()).optional().describe("Node capabilities the task needs; defaults per kind"),
};

type SubmitTaskArgs = { [K in keyof typeof submitTaskShape]: z.infer<(typeof submitTaskShape)[K]> };

export function toCreateTaskInput(args: SubmitTaskArgs): CreateTaskInput {
  if (args.kind === "shell") {
    if (!args.command) {
      throw new ToolInputError("shell tasks need a command");
    }
    return {
      kind: "shell.exec",
      adapter: "shell",
      requires: args.requires ?? ["shell"],
      payload: { command: args.command, repo: args.repo, branch: args.branch, cwd: args.cwd },
    };
  }
  if (args.kind === "inference") {
    if (!args.model || !args.prompt) {
      throw new ToolInputError("inference tasks need a model and a prompt");
    }
    const adapter = args.adapter ?? "ollama";
    return {
      kind: "inference.batch",
      adapter,
      requires: args.requires ?? [adapter],
      payload: { model: args.model, prompt: args.prompt },
    };
  }
  if (!args.harness || !args.prompt || !args.repo) {
    throw new ToolInputError("harness tasks need a harness, a prompt and a repo");
  }
  return {
    kind: "agent.run",
    adapter: args.harness,
    requires: args.requires ?? [args.harness, "git"],
    payload: {
      prompt: args.prompt,
      repo: args.repo,
      model: args.model,
      branch: args.branch,
      testCommand: args.testCommand,
      interactive: args.interactive || undefined,
    },
  };
}

/** Builds an MCP server whose tools call the Workplane operator API. Connect it to any transport. */
export function createWorkplaneMcpServer(options: WorkplaneMcpOptions): McpServer {
  const client = new WorkplaneClient({ baseUrl: options.baseUrl, token: options.token, fetch: options.fetch });
  const server = new McpServer({ name: "workplane", version: options.version ?? "0.0.0" });

  server.registerTool(
    "list_nodes",
    { title: "List nodes", description: "Fleet nodes with their capabilities, status and last heartbeat.", annotations: READ },
    () => call(() => client.listNodes()),
  );

  server.registerTool(
    "submit_task",
    {
      title: "Submit task",
      description: "Queue a task for the fleet. Returns the task immediately; poll get_task or list_runs, then tail_logs.",
      inputSchema: submitTaskShape,
      annotations: DISPATCH,
    },
    (args) => call(async () => client.createTask(toCreateTaskInput(args))),
  );

  server.registerTool(
    "list_tasks",
    { title: "List tasks", description: "Tasks, newest first, optionally filtered by status.", inputSchema: { status: RUN_STATUS.optional() }, annotations: READ },
    ({ status }) => call(() => client.listTasks({ status })),
  );

  server.registerTool(
    "get_task",
    { title: "Get task", description: "One task by ID.", inputSchema: { taskId: z.string() }, annotations: READ },
    ({ taskId }) => call(() => client.getTask(taskId)),
  );

  server.registerTool(
    "list_runs",
    {
      title: "List runs",
      description: "Runs (attempts of tasks), optionally for one task or one status.",
      inputSchema: { taskId: z.string().optional(), status: RUN_STATUS.optional() },
      annotations: READ,
    },
    ({ taskId, status }) => call(() => client.listRuns({ taskId, status })),
  );

  server.registerTool(
    "get_run",
    { title: "Get run", description: "One run by ID, including its status and exit code.", inputSchema: { runId: z.string() }, annotations: READ },
    ({ runId }) => call(() => client.getRun(runId)),
  );

  server.registerTool(
    "tail_logs",
    {
      title: "Tail logs",
      description: "Log lines for a run. Pass afterId (the highest log id you have seen) to get only newer lines.",
      inputSchema: { runId: z.string(), afterId: z.number().int().nonnegative().optional() },
      annotations: READ,
    },
    ({ runId, afterId }) => call(() => client.getRunLogs(runId, { afterId })),
  );

  server.registerTool(
    "list_artifacts",
    { title: "List artifacts", description: "Artifacts a run produced (diffs, reports, files).", inputSchema: { runId: z.string() }, annotations: READ },
    ({ runId }) => call(() => client.listRunArtifacts(runId)),
  );

  server.registerTool(
    "get_artifact",
    { title: "Get artifact", description: "One artifact of a run by artifact ID.", inputSchema: { runId: z.string(), artifactId: z.string() }, annotations: READ },
    ({ runId, artifactId }) =>
      call(async () => {
        const artifact = (await client.listRunArtifacts(runId)).artifacts.find((item) => item.id === artifactId);
        if (!artifact) {
          throw new ToolInputError(`run ${runId} has no artifact ${artifactId}`);
        }
        return artifact;
      }),
  );

  server.registerTool(
    "send_run_input",
    {
      title: "Send run input",
      description: "Steer an interactive run: write to stdin, send a signal, or resize the terminal. Give exactly one of stdin, signal or resize.",
      inputSchema: {
        runId: z.string(),
        stdin: z.string().optional().describe("Text to write; include \\n to submit a line"),
        signal: z.enum(["SIGINT", "SIGTERM", "SIGKILL"]).optional(),
        resize: z.object({ cols: z.number().int().positive(), rows: z.number().int().positive() }).optional(),
      },
      annotations: WRITE,
    },
    ({ runId, stdin, signal, resize }) =>
      call(async () => {
        const given = [stdin !== undefined, signal !== undefined, resize !== undefined].filter(Boolean).length;
        if (given !== 1) {
          throw new ToolInputError("give exactly one of stdin, signal or resize");
        }
        const input: AppendInputEventInput =
          stdin !== undefined
            ? { kind: "stdin", payload: { data: stdin } }
            : signal !== undefined
              ? { kind: "signal", payload: { signal } }
              : { kind: "resize", payload: { cols: resize?.cols, rows: resize?.rows } };
        return client.sendRunInput(runId, input);
      }),
  );

  server.registerTool(
    "cancel_task",
    { title: "Cancel task", description: "Cancel a queued or running task. Stops work in progress.", inputSchema: { taskId: z.string() }, annotations: DESTRUCTIVE },
    ({ taskId }) => call(() => client.cancelTask(taskId)),
  );

  server.registerTool(
    "retry_task",
    { title: "Retry task", description: "Start a new run of a finished task with the same inputs.", inputSchema: { taskId: z.string() }, annotations: DESTRUCTIVE },
    ({ taskId }) => call(() => client.retryTask(taskId)),
  );

  server.registerTool(
    "list_skills",
    { title: "List skills", description: "Skills (workplans) the server can run, with their input schemas.", annotations: READ },
    () => call(() => client.listSkills()),
  );

  server.registerTool(
    "run_skill",
    {
      title: "Run skill",
      description: "Start a skill now. Returns the workplan run immediately; poll get_workplan_run for status and step results.",
      inputSchema: { planId: z.string().describe("Skill name from list_skills"), inputs: z.record(z.unknown()).optional() },
      annotations: DISPATCH,
    },
    ({ planId, inputs }) => call(() => client.startWorkplanRun({ planId, inputs })),
  );

  server.registerTool(
    "get_workplan_run",
    {
      title: "Get workplan run",
      description: "A workplan run with its step results. Each fleet step links to the task and run it created.",
      inputSchema: { workplanRunId: z.string() },
      annotations: READ,
    },
    ({ workplanRunId }) =>
      call(async () => {
        const [run, { steps }] = await Promise.all([client.getWorkplanRun(workplanRunId), client.listWorkplanSteps(workplanRunId)]);
        return { ...run, steps };
      }),
  );

  server.registerTool(
    "list_approvals",
    {
      title: "List approvals",
      description: "Gate steps of a workplan run that are waiting for a human decision.",
      inputSchema: { workplanRunId: z.string() },
      annotations: READ,
    },
    ({ workplanRunId }) => call(() => client.listWorkplanApprovals(workplanRunId)),
  );

  const decisionShape = { workplanRunId: z.string(), stepId: z.string(), reason: z.string().optional() };
  server.registerTool(
    "approve_step",
    { title: "Approve gate step", description: "Let a paused gate step pass so the workplan continues.", inputSchema: decisionShape, annotations: DESTRUCTIVE },
    ({ workplanRunId, stepId, reason }) => call(() => client.approveWorkplanStep(workplanRunId, stepId, { reason, by: "mcp" })),
  );

  server.registerTool(
    "reject_step",
    { title: "Reject gate step", description: "Fail a paused gate step; its dependents are skipped.", inputSchema: decisionShape, annotations: DESTRUCTIVE },
    ({ workplanRunId, stepId, reason }) => call(() => client.rejectWorkplanStep(workplanRunId, stepId, { reason, by: "mcp" })),
  );

  server.registerTool(
    "list_schedules",
    { title: "List schedules", description: "Cron schedules for skills.", inputSchema: { enabled: z.boolean().optional() }, annotations: READ },
    ({ enabled }) => call(() => client.listSchedules({ enabled })),
  );

  server.registerTool(
    "create_schedule",
    {
      title: "Create schedule",
      description: "Run a skill on a cron schedule.",
      inputSchema: {
        planId: z.string(),
        cronExpression: z.string().describe("Five-field cron, for example 0 9 * * 1-5"),
        timezone: z.string().describe("IANA timezone, for example Europe/London"),
        name: z.string().optional(),
        inputs: z.record(z.unknown()).optional(),
        enabled: z.boolean().optional(),
      },
      annotations: WRITE,
    },
    ({ planId, cronExpression, timezone, name, inputs, enabled }) =>
      call(() => client.createSchedule({ planId, name: name ?? planId, cronExpression, timezone, inputs, enabled, createdBy: "mcp" })),
  );

  server.registerTool(
    "toggle_schedule",
    {
      title: "Enable or disable schedule",
      description: "Turn a schedule on or off.",
      inputSchema: { scheduleId: z.string(), enabled: z.boolean() },
      annotations: { ...WRITE, idempotentHint: true },
    },
    ({ scheduleId, enabled }) => call(() => client.updateSchedule(scheduleId, { enabled })),
  );

  return server;
}
