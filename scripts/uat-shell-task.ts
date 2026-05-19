import {
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
  const command = parseArg("--command") ?? process.env.UAT_SHELL_COMMAND ?? "echo workplane-uat-ok";
  const repo = parseArg("--repo") ?? process.env.UAT_REPO;
  const branch = parseArg("--branch") ?? process.env.UAT_BRANCH;

  await runUatWithServices(async (env) => {
    process.stdout.write("Submitting shell UAT task...\n");
    const task = await submitTask(env, {
      kind: "shell.exec",
      adapter: "shell",
      requires: repo ? ["shell", "git"] : ["shell"],
      payload: { command, repo, branch },
    });

    const completed = await waitForTaskCompletion(env, task.id);
    await printRunSummary(env, task.id, completed);
  });
}

void main().catch((error) => {
  process.stderr.write(`UAT error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
