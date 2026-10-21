import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { startHttpServer } from "./http.js";
import { createWorkplaneMcpServer } from "./server.js";

interface Recorded {
  method: string;
  path: string;
  body: unknown;
  authorization: string | null;
}

function fakeApi(routes: Record<string, unknown>) {
  const calls: Recorded[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    calls.push({
      method,
      path: `${url.pathname}${url.search}`,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      authorization: headers.get("authorization"),
    });
    const key = `${method} ${url.pathname}`;
    if (!(key in routes)) {
      return new Response(JSON.stringify({ error: "not found" }), { status: 404, statusText: "Not Found" });
    }
    return new Response(JSON.stringify(routes[key]), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { calls, fetchImpl };
}

async function connect(routes: Record<string, unknown>) {
  const api = fakeApi(routes);
  const server = createWorkplaneMcpServer({ baseUrl: "http://plane.test", token: "op-token", fetch: api.fetchImpl });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientSide);
  return { client, calls: api.calls };
}

function textOf(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const [first] = result.content as Array<{ type: string; text: string }>;
  return first.text;
}

test("exposes the spec tool set with destructive tools annotated", async () => {
  const { client } = await connect({});
  const { tools } = await client.listTools();
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  for (const name of [
    "list_nodes",
    "submit_task",
    "list_tasks",
    "get_task",
    "list_runs",
    "get_run",
    "tail_logs",
    "list_artifacts",
    "get_artifact",
    "send_run_input",
    "cancel_task",
    "retry_task",
    "list_skills",
    "run_skill",
    "list_schedules",
    "create_schedule",
    "toggle_schedule",
  ]) {
    assert.ok(byName.has(name), `missing tool ${name}`);
  }
  assert.equal(byName.get("cancel_task")?.annotations?.destructiveHint, true);
  assert.equal(byName.get("retry_task")?.annotations?.destructiveHint, true);
  assert.equal(byName.get("list_nodes")?.annotations?.readOnlyHint, true);
  assert.equal(byName.get("submit_task")?.annotations?.openWorldHint, true);
});

test("submit_task maps each kind onto POST /tasks with the operator token", async () => {
  const { client, calls } = await connect({ "POST /tasks": { id: "task_1" } });

  const shell = await client.callTool({ name: "submit_task", arguments: { kind: "shell", command: "uname -a" } });
  assert.equal(shell.isError, undefined);
  assert.match(textOf(shell), /task_1/);
  assert.deepEqual(calls[0].body, {
    kind: "shell.exec",
    adapter: "shell",
    requires: ["shell"],
    payload: { command: "uname -a" },
  });
  assert.equal(calls[0].authorization, "Bearer op-token");

  await client.callTool({
    name: "submit_task",
    arguments: { kind: "harness", harness: "codex", prompt: "fix it", repo: "https://example.test/r.git", interactive: true },
  });
  assert.deepEqual(calls[1].body, {
    kind: "agent.run",
    adapter: "codex",
    requires: ["codex", "git"],
    payload: { prompt: "fix it", repo: "https://example.test/r.git", interactive: true },
  });

  const invalid = await client.callTool({ name: "submit_task", arguments: { kind: "harness", prompt: "x" } });
  assert.equal(invalid.isError, true);
  assert.match(textOf(invalid), /need a harness, a prompt and a repo/);
  assert.equal(calls.length, 2, "invalid input never reaches the API");
});

test("API errors come back as tool errors, and filters become query strings", async () => {
  const { client, calls } = await connect({ "GET /runs/run_1/logs": { logs: [] } });
  const missing = await client.callTool({ name: "get_task", arguments: { taskId: "task_nope" } });
  assert.equal(missing.isError, true);
  assert.match(textOf(missing), /^404 Not Found from \/tasks\/task_nope/);

  await client.callTool({ name: "tail_logs", arguments: { runId: "run_1", afterId: 41 } });
  assert.equal(calls.at(-1)?.path, "/runs/run_1/logs?afterId=41");
});

test("send_run_input needs exactly one kind of input", async () => {
  const { client, calls } = await connect({ "POST /runs/run_1/input": { id: 1 } });
  const both = await client.callTool({ name: "send_run_input", arguments: { runId: "run_1", stdin: "y\n", signal: "SIGINT" } });
  assert.equal(both.isError, true);

  await client.callTool({ name: "send_run_input", arguments: { runId: "run_1", resize: { cols: 120, rows: 40 } } });
  assert.deepEqual(calls.at(-1)?.body, { kind: "resize", payload: { cols: 120, rows: 40 } });
});

test("run_skill, get_workplan_run and approvals use the workplan run routes", async () => {
  const { client, calls } = await connect({
    "POST /workplan-runs": { id: "wpr_1", status: "running" },
    "GET /workplan-runs/wpr_1": { id: "wpr_1", status: "waiting_for_approval" },
    "GET /workplan-runs/wpr_1/steps": { steps: [{ stepId: "build", taskId: "task_9", runId: "run_9" }] },
    "POST /workplan-runs/wpr_1/steps/ship/approve": { ok: true },
  });
  await client.callTool({ name: "run_skill", arguments: { planId: "hello", inputs: { message: "hi" } } });
  assert.deepEqual(calls[0].body, { planId: "hello", inputs: { message: "hi" } });

  const run = JSON.parse(textOf(await client.callTool({ name: "get_workplan_run", arguments: { workplanRunId: "wpr_1" } })));
  assert.equal(run.status, "waiting_for_approval");
  assert.equal(run.steps[0].runId, "run_9");

  await client.callTool({ name: "approve_step", arguments: { workplanRunId: "wpr_1", stepId: "ship", reason: "looks good" } });
  assert.deepEqual(calls.at(-1)?.body, { reason: "looks good", by: "mcp" });
});

test("get_artifact finds one artifact in the run's list", async () => {
  const { client } = await connect({
    "GET /runs/run_1/artifacts": { artifacts: [{ id: "art_1", name: "diff.patch" }] },
  });
  const found = await client.callTool({ name: "get_artifact", arguments: { runId: "run_1", artifactId: "art_1" } });
  assert.match(textOf(found), /diff\.patch/);
  const absent = await client.callTool({ name: "get_artifact", arguments: { runId: "run_1", artifactId: "art_2" } });
  assert.equal(absent.isError, true);
});

test("Streamable HTTP: rejects calls without a bearer token and forwards the caller's token", async () => {
  const seen: Array<string | undefined> = [];
  const plane = createServer((req, res) => {
    seen.push(req.headers.authorization);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ nodes: [{ id: "node_1" }] }));
  });
  await new Promise<void>((resolve) => plane.listen(0, "127.0.0.1", resolve));
  const planeUrl = `http://127.0.0.1:${(plane.address() as AddressInfo).port}`;
  const http = await startHttpServer({ baseUrl: planeUrl, port: 0 });
  const mcpUrl = new URL(`http://127.0.0.1:${(http.address() as AddressInfo).port}/mcp`);

  try {
    const anonymous = await fetch(mcpUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    assert.equal(anonymous.status, 401);

    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(mcpUrl, { requestInit: { headers: { authorization: "Bearer caller-token" } } }),
    );
    const result = await client.callTool({ name: "list_nodes", arguments: {} });
    assert.match(textOf(result), /node_1/);
    assert.deepEqual(seen, ["Bearer caller-token"]);
    await client.close();
  } finally {
    await new Promise((resolve) => http.close(resolve));
    await new Promise((resolve) => plane.close(resolve));
  }
});
