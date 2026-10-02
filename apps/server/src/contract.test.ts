import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { WorkplaneApiError, WorkplaneClient } from "@workplane/client";
import { runMigration } from "@workplane/db/migration";

/**
 * Contract tests: the real server process, over HTTP, driven through @workplane/client for every
 * endpoint the web UI relies on. They protect the shape of the API the UI is built against.
 */

const serverEntry = fileURLToPath(new URL("./index.ts", import.meta.url));
const OPERATOR = "contract-operator-token";
const NODE = "contract-node-token";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

interface RunningServer {
  url: string;
  stop: () => Promise<void>;
}

async function startServer(extraEnv: Record<string, string>): Promise<RunningServer> {
  const dir = mkdtempSync(join(tmpdir(), "workplane-contract-"));
  const databaseUrl = `sqlite://${join(dir, "workplane.db")}`;
  await runMigration(databaseUrl);
  const port = await freePort();
  const child: ChildProcess = spawn(process.execPath, ["--import", "tsx", serverEntry], {
    env: {
      ...process.env,
      HOME: dir,
      DATABASE_URL: databaseUrl,
      WORKPLANE_SERVER_PORT: String(port),
      WORKPLANE_OPERATOR_TOKEN: OPERATOR,
      WORKPLANE_NODE_TOKEN: NODE,
      WORKPLANE_SCHEDULER_ENABLED: "false",
      ...extraEnv,
    },
    stdio: "ignore",
  });
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(`${url}/healthz`)).ok) {
        break;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (attempt === 99) {
      child.kill();
      throw new Error("contract test server did not start");
    }
  }
  return {
    url,
    stop: async () => {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe("API contract through @workplane/client", () => {
  let server: RunningServer;
  let operator: WorkplaneClient;
  let node: WorkplaneClient;

  before(async () => {
    server = await startServer({ WORKPLANE_CORS_ORIGINS: "http://ui.test" });
    operator = new WorkplaneClient({ baseUrl: server.url, token: OPERATOR });
    node = new WorkplaneClient({ baseUrl: server.url, token: NODE });
  });

  after(async () => {
    await server.stop();
  });

  test("health, skills, plans", async () => {
    assert.deepEqual(await operator.health(), { ok: true });

    const { skills } = await operator.listSkills();
    const names = skills.map((skill) => skill.name).sort();
    assert.deepEqual(names, ["code-review", "hello", "summarize-file"]);
    const summarize = skills.find((skill) => skill.name === "summarize-file");
    assert.equal(summarize?.inputSchema.type, "object");
    assert.deepEqual(summarize?.inputSchema.required, ["file"]);
    assert.equal(summarize?.inputSchema.properties.file.type, "string");

    assert.deepEqual((await operator.listPlans()).plans.sort(), names);
  });

  test("task lifecycle, run logs with a cursor, nodes and artifacts", async () => {
    assert.deepEqual((await operator.listNodes()).nodes, []);

    const task = await operator.createTask({
      kind: "shell.exec",
      adapter: "shell",
      payload: { command: "echo hi" },
      requires: ["shell"],
    });
    assert.equal(task.status, "queued");
    assert.equal((await operator.getTask(task.id)).id, task.id);
    assert.ok((await operator.listTasks({ status: "queued" })).tasks.some((t) => t.id === task.id));
    assert.equal((await operator.listTasks({ status: "failed" })).tasks.length, 0);

    const registered = await node.request<{ id: string; name: string }>("/nodes/register", {
      method: "POST",
      body: { name: "contract-node", capabilities: ["shell"] },
    });
    const { nodes } = await operator.listNodes();
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].id, registered.id);
    assert.equal(nodes[0].status, "online");
    assert.deepEqual(nodes[0].capabilities, ["shell"]);

    const polled = await node.request<{ assignment: { run: { id: string } } | null }>(`/nodes/${registered.id}/poll`, {
      method: "POST",
      body: { capabilities: ["shell"] },
    });
    const runId = polled.assignment?.run.id;
    assert.ok(runId, "node should be assigned the queued task");

    await node.request(`/runs/${runId}/status`, { method: "POST", body: { status: "running" } });
    await node.request(`/runs/${runId}/logs`, {
      method: "POST",
      body: { logs: [{ stream: "stdout", message: "one" }, { stream: "stdout", message: "two" }] },
    });

    const all = (await operator.getRunLogs(runId)).logs;
    assert.deepEqual(all.map((log) => log.message), ["one", "two"]);
    const firstId = all[0].id;
    assert.deepEqual((await operator.getRunLogs(runId, { afterId: firstId })).logs.map((log) => log.message), ["two"]);
    assert.deepEqual((await operator.getRunLogs(runId, { afterId: all[1].id })).logs, []);
    await assert.rejects(
      operator.request(`/runs/${runId}/logs?afterId=nope`),
      (error: unknown) => error instanceof WorkplaneApiError && error.status === 400,
    );

    assert.equal((await operator.getRun(runId)).status, "running");
    assert.ok((await operator.listRuns({ taskId: task.id })).runs.some((run) => run.id === runId));

    const input = await operator.sendRunInput(runId, { kind: "stdin", payload: { data: "x" } });
    assert.equal(input.sequence, 1);
    assert.equal((await node.listRunInputEvents(runId)).events.length, 1);
    assert.equal((await operator.listRunInputEvents(runId)).events.length, 1);

    await node.request(`/runs/${runId}/artifacts`, {
      method: "POST",
      body: { type: "file", name: "out.txt", path: "/tmp/out.txt" },
    });
    assert.equal((await operator.listRunArtifacts(runId)).artifacts[0].name, "out.txt");

    await node.request(`/runs/${runId}/status`, { method: "POST", body: { status: "failed", error: "boom" } });
    assert.equal((await operator.getTask(task.id)).status, "failed");
    const retried = await operator.retryTask(task.id);
    assert.equal(retried.status, "queued");
    assert.equal((await operator.cancelTask(task.id)).status, "cancelled");
  });

  test("errors are typed and writes need the operator token", async () => {
    await assert.rejects(
      operator.getTask("task_missing"),
      (error: unknown) => error instanceof WorkplaneApiError && error.status === 404 && /task not found/.test(error.body),
    );
    await assert.rejects(
      operator.sendRunInput("run_missing", { kind: "stdin", payload: {} }),
      (error: unknown) => error instanceof WorkplaneApiError && error.status === 404,
    );

    const anonymous = new WorkplaneClient({ baseUrl: server.url });
    await assert.rejects(
      anonymous.createTask({ kind: "shell.exec", adapter: "shell", payload: { command: "echo" } }),
      (error: unknown) => error instanceof WorkplaneApiError && error.status === 401,
    );
    assert.equal((await anonymous.listTasks()).tasks.length >= 0, true, "reads are open by default");
  });

  test("schedules and workplan runs", async () => {
    const created = await operator.createSchedule({
      planId: "hello",
      name: "contract",
      cronExpression: "0 0 1 1 *",
      timezone: "UTC",
      inputs: { message: "from contract" },
    });
    assert.equal(created.enabled, true);
    assert.ok((await operator.listSchedules()).schedules.some((schedule) => schedule.id === created.id));
    assert.equal((await operator.getSchedule(created.id)).name, "contract");
    assert.equal((await operator.updateSchedule(created.id, { enabled: false })).enabled, false);
    assert.equal((await operator.listSchedules({ enabled: true })).schedules.length, 0);

    const run = await operator.runScheduleNow(created.id);
    assert.equal(run.planId, "hello");
    const detail = await operator.getWorkplanRun(run.id);
    assert.equal(detail.id, run.id);
    assert.ok((await operator.listWorkplanRuns({ scheduleId: created.id })).runs.length >= 1);
    assert.ok(Array.isArray((await operator.listWorkplanSteps(run.id)).steps));
    assert.ok(Array.isArray((await operator.tickSchedules()).runs));

    assert.deepEqual(await operator.deleteSchedule(created.id), { ok: true });
    await assert.rejects(
      operator.createSchedule({ planId: "nope", name: "x", cronExpression: "* * * * *", timezone: "UTC" }),
      (error: unknown) => error instanceof WorkplaneApiError && error.status === 400 && /availablePlans/.test(error.body),
    );
  });

  test("CORS: preflight for an allowed origin, none for others", async () => {
    const allowed = await fetch(`${server.url}/tasks`, {
      method: "OPTIONS",
      headers: { origin: "http://ui.test", "access-control-request-method": "GET" },
    });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get("access-control-allow-origin"), "http://ui.test");

    const denied = await fetch(`${server.url}/tasks`, { headers: { origin: "http://evil.test" } });
    assert.equal(denied.headers.get("access-control-allow-origin"), null);
  });
});

describe("WORKPLANE_PROTECT_READS", () => {
  let server: RunningServer;

  before(async () => {
    server = await startServer({ WORKPLANE_PROTECT_READS: "true" });
  });

  after(async () => {
    await server.stop();
  });

  test("reads need a token, /healthz does not, and CORS stays closed by default", async () => {
    const anonymous = new WorkplaneClient({ baseUrl: server.url });
    assert.deepEqual(await anonymous.health(), { ok: true });
    await assert.rejects(
      anonymous.listTasks(),
      (error: unknown) => error instanceof WorkplaneApiError && error.status === 401,
    );
    assert.deepEqual((await new WorkplaneClient({ baseUrl: server.url, token: OPERATOR }).listTasks()).tasks, []);
    assert.deepEqual((await new WorkplaneClient({ baseUrl: server.url, token: NODE }).listNodes()).nodes, []);

    const noCors = await fetch(`${server.url}/healthz`, { headers: { origin: "http://ui.test" } });
    assert.equal(noCors.headers.get("access-control-allow-origin"), null);
  });
});
