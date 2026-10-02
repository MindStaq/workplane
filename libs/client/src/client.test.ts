import assert from "node:assert/strict";
import { test } from "node:test";
import { WorkplaneApiError, WorkplaneClient } from "./client.js";

interface Call {
  url: string;
  init: RequestInit;
}

function clientWith(respond: (call: Call) => Response, token?: string): { client: WorkplaneClient; calls: Call[] } {
  const calls: Call[] = [];
  const client = new WorkplaneClient({
    baseUrl: "http://cp.test/",
    token,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = { url: String(input), init: init ?? {} };
      calls.push(call);
      return respond(call);
    }) as typeof fetch,
  });
  return { client, calls };
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("builds URLs, trims the base URL and omits undefined query values", async () => {
  const { client, calls } = clientWith(() => json({ tasks: [] }));
  await client.listTasks({ status: "running" });
  await client.listTasks({});
  await client.getRunLogs("run/1", { afterId: 0 });
  assert.deepEqual(
    calls.map((call) => call.url),
    ["http://cp.test/tasks?status=running", "http://cp.test/tasks", "http://cp.test/runs/run%2F1/logs?afterId=0"],
  );
});

test("sends the bearer token and a JSON body only when provided", async () => {
  const { client, calls } = clientWith(() => json({ id: "task_1" }), "secret");
  await client.createTask({ kind: "shell.exec", adapter: "shell", payload: { command: "echo" } });
  await client.retryTask("task_1");
  const [create, retry] = calls;
  assert.equal(create.init.method, "POST");
  assert.equal((create.init.headers as Record<string, string>).authorization, "Bearer secret");
  assert.equal(JSON.parse(String(create.init.body)).kind, "shell.exec");
  assert.equal(retry.init.body, undefined);
});

test("no authorization header without a token", async () => {
  const { client, calls } = clientWith(() => json({ ok: true }));
  await client.health();
  assert.equal((calls[0].init.headers as Record<string, string>).authorization, undefined);
});

test("non-2xx responses throw WorkplaneApiError with the legacy message format", async () => {
  const { client } = clientWith(
    () => new Response('{"error":"task not found"}', { status: 404, statusText: "Not Found" }),
  );
  await assert.rejects(client.getTask("task_x"), (error: unknown) => {
    assert.ok(error instanceof WorkplaneApiError);
    assert.equal(error.status, 404);
    assert.equal(error.path, "/tasks/task_x");
    assert.equal(error.message, '404 Not Found from /tasks/task_x: {"error":"task not found"}');
    return true;
  });
});
