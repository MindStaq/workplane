import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runMigration } from "./migration.js";
import { createStore } from "./client.js";

/** Set to a throwaway Postgres database to run the same checks against the Postgres store. */
const pgUrl = process.env.WORKPLANE_TEST_DATABASE_URL;

async function checkCapabilityMatching(databaseUrl: string): Promise<void> {
  await runMigration(databaseUrl);
  // runMigration ends the pool cached for its URL, so the store needs a distinct URL (and pool).
  const storeUrl = databaseUrl.startsWith("postgres") ? `${databaseUrl}${databaseUrl.includes("?") ? "&" : "?"}application_name=poll-test` : databaseUrl;
  const { store, close } = createStore(storeUrl);
  try {
    const tag = `cap-${randomBytes(4).toString("hex")}`;
    const task = await store.createTask({ kind: "shell.exec", adapter: "shell", payload: {}, requires: [tag] });
    const node = await store.registerNode("poll-test", [tag, "git", "ollama"]);

    assert.equal(await store.pollNode(node.id, ["git", "ollama"]), null, "a node missing a required capability gets nothing");

    const assignment = await store.pollNode(node.id, [tag, "git", "ollama"]);
    assert.equal(assignment?.task.id, task.id, "a node with more capabilities than the task needs gets the task");
  } finally {
    await close();
  }
}

test("pollNode assigns tasks whose requirements are a subset of the node's capabilities (sqlite)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "workplane-poll-"));
  try {
    await checkCapabilityMatching(`sqlite://${join(dir, "test.db")}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("pollNode assigns tasks whose requirements are a subset of the node's capabilities (postgres)", { skip: !pgUrl && "set WORKPLANE_TEST_DATABASE_URL" }, async () => {
  await checkCapabilityMatching(pgUrl as string);
});
