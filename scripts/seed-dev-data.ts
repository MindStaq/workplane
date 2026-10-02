/**
 * Seeds a throwaway SQLite database with data in every state a UI needs to render: tasks that are
 * queued, assigned, running, succeeded, failed and cancelled, runs with logs and artifacts, nodes,
 * a schedule and workplan runs. It never touches ~/.workplane.
 *
 *   node --import tsx scripts/seed-dev-data.ts [--db <path>] [--reset]
 *
 * Defaults to .workplane/dev/dev.db. Running it twice is a no-op unless --reset is given.
 */
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { createStore } from "@workplane/db";
import { runMigration } from "@workplane/db/migration";
import { ScheduleBuilder } from "@workplane/workplans";

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const dbPath = resolve(argValue("--db") ?? ".workplane/dev/dev.db");
const databaseUrl = `sqlite://${dbPath}`;

if (process.argv.includes("--reset")) {
  for (const suffix of ["", "-wal", "-shm"]) {
    rmSync(`${dbPath}${suffix}`, { force: true });
  }
}

await runMigration(databaseUrl);
const { store, close } = createStore(databaseUrl);

if ((await store.listTasks()).length > 0) {
  process.stdout.write(`${dbPath} already has data; use --reset to start over\n`);
  await close();
  process.exit(0);
}

const laptop = await store.registerNode("seed-laptop", ["shell", "git", "node"]);
await store.registerNode("seed-gpu-box", ["shell", "ollama"]);
const caps = ["shell", "git", "node"];

async function finishedTask(command: string, status: "succeeded" | "failed", logs: string[], error?: string) {
  const task = await store.createTask({ kind: "shell.exec", adapter: "shell", payload: { command }, requires: ["shell"] });
  const assignment = await store.pollNode(laptop.id, caps);
  if (!assignment) {
    throw new Error("seed: expected an assignment");
  }
  const runId = assignment.run.id;
  await store.updateRunStatus(runId, "running");
  await store.appendRunLogs(runId, [
    { stream: "system", message: "run started" },
    ...logs.map((message) => ({ stream: status === "failed" ? ("stderr" as const) : ("stdout" as const), message })),
  ]);
  await store.updateRunStatus(runId, status, error);
  return { task, runId };
}

const ok = await finishedTask("echo hello", "succeeded", ["hello"]);
await store.createArtifact(ok.runId, { type: "file", name: "shell-result.json", path: "/tmp/seed/shell-result.json", metadata: { exitCode: 0 } });
await finishedTask("npm test", "succeeded", ["PASS  all suites", "Tests: 42 passed"]);
await finishedTask("exit 3", "failed", ["command failed with exit code 3"], "exit code 3");

await store.createTask({ kind: "shell.exec", adapter: "shell", payload: { command: "sleep 600" }, requires: ["shell"] });
const running = await store.pollNode(laptop.id, caps);
if (running) {
  await store.updateRunStatus(running.run.id, "running");
  await store.appendRunLogs(running.run.id, [
    { stream: "system", message: "run started" },
    { stream: "stdout", message: "waiting..." },
  ]);
}

await store.createTask({
  kind: "agent.run",
  adapter: "claude-code",
  payload: { prompt: "Start exploring the codebase", repo: "git@example.com:org/repo.git", interactive: true },
  requires: ["claude-code", "git"],
});
const session = await store.pollNode(laptop.id, [...caps, "claude-code"]);
if (session) {
  await store.updateRunStatus(session.run.id, "running");
  await store.appendRunLogs(session.run.id, [
    { stream: "system", message: "interactive session started (pty)" },
    { stream: "stdout", message: "claude> exploring the repository" },
  ]);
  await store.createArtifact(session.run.id, { type: "transcript", name: "session.log", path: "/tmp/seed/session.log", metadata: { live: true } });
}

await store.createTask({ kind: "shell.exec", adapter: "shell", payload: { command: "echo assigned" }, requires: ["shell"] });
await store.pollNode(laptop.id, caps);

const cancelled = await store.createTask({ kind: "shell.exec", adapter: "shell", payload: { command: "echo cancelled" }, requires: ["gpu"] });
await store.cancelTask(cancelled.id);
await store.createTask({ kind: "inference.batch", adapter: "ollama", payload: { model: "llama3", prompt: "Summarize" }, requires: ["gpu"] });
await store.createTask({ kind: "shell.exec", adapter: "shell", payload: { command: "echo waits for a gpu node" }, requires: ["gpu"] });

const cron = "*/5 * * * *";
const schedule = await store.createWorkplanSchedule({
  planId: "hello",
  name: "Every five minutes",
  cronExpression: cron,
  timezone: "UTC",
  inputs: { message: "hello from the seeded schedule" },
  nextRunAt: ScheduleBuilder.nextRunAt(cron, "UTC"),
});
await store.createWorkplanSchedule({
  planId: "code-review",
  name: "Nightly review (paused)",
  cronExpression: "0 2 * * *",
  timezone: "UTC",
  enabled: false,
  nextRunAt: null,
});

const done = await store.tryCreateWorkplanRun({ scheduleId: schedule.id, planId: "hello", planName: "Hello" });
if (done) {
  await store.appendWorkplanStepResults(done.id, [{ stepId: "echo", stepName: "Echo", output: "hello from the seeded schedule", exitCode: 0, durationMs: 31 }]);
  await store.updateWorkplanRun(done.id, "completed", undefined, new Date().toISOString());
}
const broken = await store.tryCreateWorkplanRun({ planId: "summarize-file", planName: "Summarize file" });
if (broken) {
  await store.appendWorkplanStepResults(broken.id, [{ stepId: "read", stepName: "Read file", output: "", exitCode: 1, durationMs: 4 }]);
  await store.updateWorkplanRun(broken.id, "failed", "file not found", new Date().toISOString());
}
await store.tryCreateWorkplanRun({ planId: "code-review", planName: "Code review" });

const counts = (await store.listTasks()).reduce<Record<string, number>>((acc, task) => ({ ...acc, [task.status]: (acc[task.status] ?? 0) + 1 }), {});
process.stdout.write(`seeded ${dbPath}\n  tasks: ${JSON.stringify(counts)}\n  nodes: 2, schedules: 2, workplan runs: 3\n`);
await close();
