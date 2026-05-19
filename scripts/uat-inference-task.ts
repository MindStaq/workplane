import {
  commandExists,
  runUatWithServices,
  submitTask,
  waitForTaskCompletion,
  printRunSummary,
} from "./uat-common.js";

async function main(): Promise<void> {
  if (!(await commandExists("ollama"))) {
    process.stdout.write("Skipping inference UAT: `ollama` not found on PATH\n");
    return;
  }

  const model = process.env.UAT_OLLAMA_MODEL ?? "llama3.2";
  const prompt = process.env.UAT_INFERENCE_PROMPT ?? "Reply with exactly: workplane-inference-ok";

  await runUatWithServices(async (env) => {
    process.stdout.write("Submitting ollama inference UAT task...\n");
    const task = await submitTask(env, {
      kind: "inference.batch",
      adapter: "ollama",
      requires: ["ollama"],
      payload: { model, prompt },
    });

    const completed = await waitForTaskCompletion(env, task.id);
    await printRunSummary(env, task.id, completed);
  });
}

void main().catch((error) => {
  process.stderr.write(`UAT error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
