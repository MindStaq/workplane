import {
  commandExists,
  runUatWithServices,
  submitTask,
  waitForTaskCompletion,
  printRunSummary,
} from "./uat-common.js";

function parseArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function main(): Promise<void> {
  if (!(await commandExists("aider"))) {
    process.stdout.write("Skipping aider UAT: `aider` not found on PATH\n");
    return;
  }

  const repo = parseArg("--repo") ?? process.env.UAT_REPO;
  if (!repo) {
    throw new Error("--repo or UAT_REPO is required for aider UAT");
  }

  const prompt = parseArg("--prompt") ?? "Add a comment to README explaining this is a UAT run.";
  const branch = parseArg("--branch");

  await runUatWithServices(async (env) => {
    process.stdout.write("Submitting aider UAT task...\n");
    const task = await submitTask(env, {
      kind: "agent.run",
      adapter: "aider",
      requires: ["git", "aider"],
      payload: { repo, prompt, branch },
    });

    const completed = await waitForTaskCompletion(env, task.id);
    await printRunSummary(env, task.id, completed);
  });
}

void main().catch((error) => {
  process.stderr.write(`UAT error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
