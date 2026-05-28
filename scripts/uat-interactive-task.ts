import {
  commandExists,
  delay,
  getRunIdForTask,
  runUatWithServices,
  sendRunInput,
  submitTask,
  waitForRunStatus,
  waitForTaskCompletion,
  printRunSummary,
} from "./uat-common.js";

function parseArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

async function waitForRun(env: Parameters<typeof getRunIdForTask>[0], taskId: string, timeoutMs: number): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      return await getRunIdForTask(env, taskId);
    } catch {
      await delay(1000);
    }
  }
  throw new Error(`run never assigned for task ${taskId}`);
}

async function main(): Promise<void> {
  const harness = parseArg("--harness") ?? "claude-code";
  const binary = harness === "claude-code" ? (process.env.WORKPLANE_CLAUDE_CODE_BIN ?? "claude") : "codex";

  if (!(await commandExists(binary))) {
    process.stdout.write(`Skipping interactive UAT: \`${binary}\` not found on PATH\n`);
    return;
  }

  const repo = parseArg("--repo") ?? process.env.UAT_REPO;
  if (!repo) {
    throw new Error("--repo or UAT_REPO is required for interactive UAT");
  }

  const prompt = parseArg("--prompt") ?? "Describe this repository in one sentence.";
  const branch = parseArg("--branch");

  await runUatWithServices(async (env) => {
    process.stdout.write(`Submitting interactive ${harness} task...\n`);
    const task = await submitTask(env, {
      kind: "agent.run",
      adapter: harness,
      requires: [harness, "git"],
      payload: { repo, prompt, branch, interactive: true },
    });
    process.stdout.write(`task submitted: ${task.id}\n`);

    const runId = await waitForRun(env, task.id, env.timeoutMs);
    process.stdout.write(`run id: ${runId}\n`);

    await waitForRunStatus(env, runId, "running");
    process.stdout.write("run is live — waiting for process to initialize\n");

    await delay(2000);

    await sendRunInput(env, runId, { kind: "stdin", payload: { data: "exit\n" } });
    process.stdout.write("sent exit via stdin — waiting for completion\n");

    const completed = await waitForTaskCompletion(env, task.id);
    await printRunSummary(env, task.id, completed);
  });
}

void main().catch((error) => {
  process.stderr.write(`UAT error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
