import { spawn } from "node:child_process";
import { loadLocalEnv } from "../packages/core/src/env.js";
import { workplaneFetch } from "../packages/core/src/http-client.js";
import { delay, ensureUatAuthEnv, runChecked, stopChild, waitForHealth } from "./uat-common.js";

loadLocalEnv();

async function expectStatus(
  label: string,
  fn: () => Promise<unknown>,
  expected: "ok" | "unauthorized",
): Promise<void> {
  try {
    await fn();
    if (expected === "unauthorized") {
      throw new Error(`${label}: expected unauthorized but request succeeded`);
    }
    process.stdout.write(`${label}: ok\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (expected === "unauthorized" && message.includes("401")) {
      process.stdout.write(`${label}: unauthorized as expected\n`);
      return;
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const env = ensureUatAuthEnv();
  const childEnv = { ...process.env };

  const server = spawn("pnpm", ["dev:server"], {
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await runChecked("pnpm", ["db:migrate"], childEnv);
    await waitForHealth(env.serverUrl, env.timeoutMs);

    await expectStatus(
      "node register without token",
      () =>
        workplaneFetch(env.serverUrl, "/nodes/register", {
          method: "POST",
          body: { name: "auth-test-node", capabilities: ["shell"] },
        }),
      "unauthorized",
    );

    await expectStatus(
      "node register with token",
      () =>
        workplaneFetch(env.serverUrl, "/nodes/register", {
          method: "POST",
          body: { name: "auth-test-node", capabilities: ["shell"] },
          nodeToken: env.nodeToken,
        }),
      "ok",
    );

    await expectStatus(
      "task submit without operator token",
      () =>
        workplaneFetch(env.serverUrl, "/tasks", {
          method: "POST",
          body: {
            kind: "shell.exec",
            adapter: "shell",
            requires: ["shell"],
            payload: { command: "echo auth-test" },
          },
        }),
      "unauthorized",
    );

    await expectStatus(
      "task submit with operator token",
      () =>
        workplaneFetch(env.serverUrl, "/tasks", {
          method: "POST",
          body: {
            kind: "shell.exec",
            adapter: "shell",
            requires: ["shell"],
            payload: { command: "echo auth-test" },
          },
          operatorToken: env.operatorToken,
        }),
      "ok",
    );
  } finally {
    stopChild(server);
    await delay(500);
  }
}

void main().catch((error) => {
  process.stderr.write(`auth integration test failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
