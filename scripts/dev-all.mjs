#!/usr/bin/env node
/**
 * Local development stack: control plane, one node and the web app, started in the right order
 * (the node exits if the server is unreachable, so it only starts once /healthz answers).
 *
 *   node scripts/dev-all.mjs [--seed] [--reset] [--db <path>] [--no-node] [--no-web]
 *
 * Uses an isolated database at .workplane/dev/dev.db (never ~/.workplane) unless DATABASE_URL is set.
 * --seed fills it with sample data in every state (see scripts/seed-dev-data.ts); --reset starts it
 * from scratch first; --db picks another SQLite file.
 * Ports: WORKPLANE_SERVER_PORT (default 8787) and WEB_PORT (default 3000).
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const flag = (name) => process.argv.includes(name);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const serverPort = process.env.WORKPLANE_SERVER_PORT ?? "8787";
const webPort = process.env.WEB_PORT ?? "3000";
const dbFlag = process.argv.indexOf("--db");
const dbPath = resolve(repoRoot, dbFlag >= 0 ? process.argv[dbFlag + 1] : join(".workplane", "dev", "dev.db"));

const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? `sqlite://${dbPath}`,
  WORKPLANE_SERVER_PORT: serverPort,
  WORKPLANE_SERVER_URL: process.env.WORKPLANE_SERVER_URL ?? `http://127.0.0.1:${serverPort}`,
  WORKPLANE_NODE_TOKEN: process.env.WORKPLANE_NODE_TOKEN ?? "dev-node-token",
  WORKPLANE_OPERATOR_TOKEN: process.env.WORKPLANE_OPERATOR_TOKEN ?? "dev-operator-token",
  WORKPLANE_NODE_NAME: process.env.WORKPLANE_NODE_NAME ?? "dev-node",
  PORT: webPort,
};

const children = [];
let stopping = false;

function stop(code) {
  if (stopping) {
    return;
  }
  stopping = true;
  for (const child of children) {
    child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 500).unref();
}

function start(label, command, args, options = {}) {
  const child = spawn(command, args, { cwd: options.cwd ?? repoRoot, env, stdio: ["ignore", "pipe", "pipe"] });
  const prefix = (stream, target) =>
    stream.on("data", (chunk) => {
      for (const line of String(chunk).split("\n").filter(Boolean)) {
        target.write(`[${label}] ${line}\n`);
      }
    });
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);
  child.on("exit", (code) => {
    if (!stopping) {
      process.stderr.write(`[${label}] exited with code ${code}; shutting down\n`);
      stop(code ?? 1);
    }
  });
  children.push(child);
  return child;
}

async function waitForHealth(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${url}/healthz`)).ok) {
        return;
      }
    } catch {
      // not up yet
    }
    await sleep(300);
  }
  throw new Error(`control plane did not become healthy at ${url} within ${timeoutMs / 1000}s`);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

const prepare = flag("--seed")
  ? ["scripts/seed-dev-data.ts", ...(process.env.DATABASE_URL ? [] : ["--db", dbPath]), ...(flag("--reset") ? ["--reset"] : [])]
  : ["libs/db/src/migrate.ts"];
const prepared = spawnSync(process.execPath, ["--import", "tsx", ...prepare], { cwd: repoRoot, env, stdio: "inherit" });
if (prepared.status !== 0) {
  process.exit(prepared.status ?? 1);
}

start("server", process.execPath, ["--import", "tsx", "apps/server/src/index.ts"]);
await waitForHealth(env.WORKPLANE_SERVER_URL, 30_000);

if (!flag("--no-node")) {
  start("node", process.execPath, ["--import", "tsx", "apps/node/src/index.ts"]);
}
if (!flag("--no-web")) {
  const next = createRequire(join(repoRoot, "apps", "web", "package.json")).resolve("next/dist/bin/next");
  start("web", process.execPath, [next, "dev", "--webpack", "--port", webPort], { cwd: join(repoRoot, "apps", "web") });
}

process.stdout.write(
  `\nWorkplane dev stack\n  control plane  ${env.WORKPLANE_SERVER_URL}\n  web            http://localhost:${webPort}\n  database       ${env.DATABASE_URL}\n  press Ctrl+C to stop\n\n`,
);
