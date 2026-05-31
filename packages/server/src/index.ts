import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { ZodError } from "zod";
import { loadServerConfig } from "../../core/src/config.js";
import { getDrizzle, getPool } from "../../db/src/client.js";
import type { WorkplaneStore } from "../../db/src/store-interface.js";
import { PgStore } from "./store.js";
import type { AppendInputEventInput, ArtifactInput, CreateTaskInput, RunLogInput, RunStatus, ServerWorkflows } from "../../types/src/index.js";
import { VanillaWorkflows } from "./workflows-vanilla.js";
import { validateCreateTaskInput, validateInputEvent } from "./validation.js";
import { checkRouteAuth, requiresConfiguredToken, routeAuthFor } from "./auth-middleware.js";

const taskStatuses = new Set<RunStatus>(["queued", "assigned", "running", "succeeded", "failed", "cancelled"]);

function parseStatus(value: string | null): RunStatus | undefined {
  if (!value) {
    return undefined;
  }
  if (!taskStatuses.has(value as RunStatus)) {
    throw new Error(`invalid status filter: ${value}`);
  }
  return value as RunStatus;
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return (body ? JSON.parse(body) : {}) as T;
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const json = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(json);
}

async function buildWorkflows(store: WorkplaneStore, config: { databaseUrl: string }): Promise<{
  workflows: ServerWorkflows;
  shutdown: () => Promise<void>;
}> {
  if (process.env.WORKPLANE_USE_DBOS === "true") {
    const { createDbosWorkflows } = await import("../../dbos/src/index.js");
    const dbos = createDbosWorkflows(store);
    await dbos.launch({
      appName: process.env.DBOS_APPLICATION_NAME ?? "workplane-server",
      systemDatabaseUrl: config.databaseUrl,
      conductorKey: process.env.DBOS_CONDUCTOR_KEY,
      conductorUrl: process.env.DBOS_CONDUCTOR_URL,
    });
    return { workflows: dbos, shutdown: () => dbos.shutdown() };
  }

  return { workflows: new VanillaWorkflows(store), shutdown: async () => {} };
}

async function main(): Promise<void> {
  const config = loadServerConfig();
  const pool = getPool(config.databaseUrl);
  const store = new PgStore(getDrizzle(pool));
  const { workflows, shutdown: shutdownWorkflows } = await buildWorkflows(store, config);

  const server = createServer(async (req, res) => {
    try {
      if (!req.url || !req.method) {
        writeJson(res, 400, { error: "invalid request" });
        return;
      }

      const url = new URL(req.url, "http://localhost");
      const routeAuth = routeAuthFor(req.method, url.pathname);
      const authConfig = { nodeToken: config.nodeToken, operatorToken: config.operatorToken };
      if (requiresConfiguredToken(routeAuth, authConfig) && !checkRouteAuth(req, res, routeAuth, authConfig)) {
        return;
      }

      if (req.method === "GET" && url.pathname === "/healthz") {
        writeJson(res, 200, { ok: true });
        return;
      }

      if (req.method === "POST" && url.pathname === "/tasks") {
        const body = await readJson<CreateTaskInput>(req);
        const validated = validateCreateTaskInput(body);
        const task = await workflows.createTask({
          kind: validated.kind,
          adapter: validated.adapter,
          payload: validated.payload,
          requires: validated.requires ?? [],
        });
        writeJson(res, 201, task);
        return;
      }

      if (req.method === "GET" && url.pathname === "/tasks") {
        const status = parseStatus(url.searchParams.get("status"));
        const tasks = await store.listTasks(status);
        writeJson(res, 200, { tasks });
        return;
      }

      if (req.method === "GET" && /^\/tasks\/[^/]+$/.test(url.pathname)) {
        const taskId = url.pathname.split("/")[2];
        const task = await store.getTask(taskId);
        if (!task) {
          writeJson(res, 404, { error: "task not found" });
          return;
        }
        writeJson(res, 200, task);
        return;
      }

      if (req.method === "POST" && /^\/tasks\/[^/]+\/retry$/.test(url.pathname)) {
        const taskId = url.pathname.split("/")[2];
        const task = await workflows.retryTask(taskId);
        if (!task) {
          writeJson(res, 409, { error: "task is not retryable" });
          return;
        }
        writeJson(res, 200, task);
        return;
      }

      if (req.method === "POST" && /^\/tasks\/[^/]+\/cancel$/.test(url.pathname)) {
        const taskId = url.pathname.split("/")[2];
        const task = await workflows.cancelTask(taskId);
        if (!task) {
          writeJson(res, 409, { error: "task is not cancellable" });
          return;
        }
        writeJson(res, 200, task);
        return;
      }

      if (req.method === "GET" && url.pathname === "/runs") {
        const taskId = url.searchParams.get("taskId") ?? undefined;
        const status = parseStatus(url.searchParams.get("status"));
        const runs = await store.listRuns({ taskId, status });
        writeJson(res, 200, { runs });
        return;
      }

      if (req.method === "GET" && /^\/runs\/[^/]+$/.test(url.pathname)) {
        const runId = url.pathname.split("/")[2];
        const run = await store.getRun(runId);
        if (!run) {
          writeJson(res, 404, { error: "run not found" });
          return;
        }
        writeJson(res, 200, run);
        return;
      }

      if (req.method === "GET" && /^\/runs\/[^/]+\/logs$/.test(url.pathname)) {
        const runId = url.pathname.split("/")[2];
        const logs = await store.getRunLogs(runId);
        writeJson(res, 200, { logs });
        return;
      }

      if (req.method === "GET" && /^\/runs\/[^/]+\/artifacts$/.test(url.pathname)) {
        const runId = url.pathname.split("/")[2];
        const artifacts = await store.listRunArtifacts(runId);
        writeJson(res, 200, { artifacts });
        return;
      }

      if (req.method === "POST" && url.pathname === "/nodes/register") {
        const body = await readJson<{ name: string; capabilities: string[]; nodeId?: string }>(req);
        const node = await store.registerNode(body.name, body.capabilities ?? [], body.nodeId);
        writeJson(res, 201, node);
        return;
      }

      if (req.method === "POST" && /^\/nodes\/[^/]+\/poll$/.test(url.pathname)) {
        const nodeId = url.pathname.split("/")[2];
        const body = await readJson<{ capabilities: string[] }>(req);
        const assignment = await store.pollNode(nodeId, body.capabilities ?? []);
        writeJson(res, 200, { assignment });
        return;
      }

      if (req.method === "POST" && /^\/runs\/[^/]+\/status$/.test(url.pathname)) {
        const runId = url.pathname.split("/")[2];
        const body = await readJson<{ status: RunStatus; error?: string }>(req);
        const run = await workflows.updateRunStatus(runId, body.status, body.error);
        if (!run) {
          writeJson(res, 404, { error: "run not found" });
          return;
        }
        writeJson(res, 200, run);
        return;
      }

      if (req.method === "POST" && /^\/runs\/[^/]+\/logs$/.test(url.pathname)) {
        const runId = url.pathname.split("/")[2];
        const body = await readJson<{ logs: RunLogInput[] }>(req);
        const inserted = await workflows.appendRunLogs(runId, body.logs ?? []);
        writeJson(res, 200, { inserted });
        return;
      }

      if (req.method === "POST" && /^\/runs\/[^/]+\/artifacts$/.test(url.pathname)) {
        const runId = url.pathname.split("/")[2];
        const body = await readJson<ArtifactInput>(req);
        const artifact = await workflows.createArtifact(runId, body);
        writeJson(res, 201, artifact);
        return;
      }

      if (req.method === "POST" && /^\/runs\/[^/]+\/input$/.test(url.pathname)) {
        const runId = url.pathname.split("/")[2];
        const run = await store.getRun(runId);
        if (!run) {
          writeJson(res, 404, { error: "run not found" });
          return;
        }
        if (run.status !== "running") {
          writeJson(res, 409, { error: "run is not active" });
          return;
        }
        const body = await readJson<AppendInputEventInput>(req);
        const validated = validateInputEvent(body);
        const event = await workflows.appendInputEvent(runId, validated);
        writeJson(res, 201, event);
        return;
      }

      if (req.method === "GET" && /^\/runs\/[^/]+\/input$/.test(url.pathname)) {
        const runId = url.pathname.split("/")[2];
        const afterSequence = Number(url.searchParams.get("afterSequence") ?? "0");
        const events = await store.getInputEvents(runId, afterSequence);
        writeJson(res, 200, { events });
        return;
      }

      if (req.method === "POST" && /^\/runs\/[^/]+\/input\/\d+\/delivered$/.test(url.pathname)) {
        const parts = url.pathname.split("/");
        const runId = parts[2];
        const sequence = Number(parts[4]);
        await workflows.markInputDelivered(runId, sequence);
        writeJson(res, 200, { ok: true });
        return;
      }

      writeJson(res, 404, { error: "not found" });
    } catch (error) {
      if (error instanceof ZodError) {
        writeJson(res, 400, { error: "invalid task payload", details: error });
        return;
      }
      if (error instanceof Error && error.message.startsWith("invalid status filter:")) {
        writeJson(res, 400, { error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : "internal error";
      writeJson(res, 500, { error: message });
    }
  });

  server.listen(config.port, () => {
    process.stdout.write(`workplane server listening on http://localhost:${config.port}\n`);
  });

  const shutdown = async (): Promise<void> => {
    await shutdownWorkflows();
    await pool.end();
    server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
