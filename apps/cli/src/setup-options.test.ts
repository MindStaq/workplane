import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultFor, parseSetupArgs, SETUP_FIELDS } from "./setup-options.js";

const field = (key: string) => SETUP_FIELDS.find((candidate) => candidate.key === key)!;

test("parseSetupArgs reads every prompt as a flag, in both --flag value and --flag=value form", () => {
  const args = parseSetupArgs([
    "--yes",
    "--database-url",
    "postgres://db/workplane",
    "--port=9000",
    "--server-url",
    "http://10.0.0.2:9000",
    "--node-token=n",
    "--operator-token",
    "o",
    "--no-migrate",
  ]);
  assert.equal(args.nonInteractive, true);
  assert.equal(args.migrate, false);
  assert.deepEqual(args.values, {
    databaseUrl: "postgres://db/workplane",
    port: "9000",
    serverUrl: "http://10.0.0.2:9000",
    nodeToken: "n",
    operatorToken: "o",
  });
});

test("parseSetupArgs rejects unknown options, missing values and a non-numeric port", () => {
  assert.throws(() => parseSetupArgs(["--nope"]), /unknown option: --nope/);
  assert.throws(() => parseSetupArgs(["--port"]), /--port needs a value/);
  assert.throws(() => parseSetupArgs(["--port", "--yes"]), /--port needs a value/);
  assert.throws(() => parseSetupArgs(["--port", "abc"]), /--port must be a number/);
});

test("defaultFor: env vars only in non-interactive mode, then the existing file, then built-in defaults", () => {
  const base = { existing: {}, resolved: {}, generateToken: () => "generated" };
  const env = { DATABASE_URL: "postgres://from-env/db" };
  assert.equal(defaultFor(field("databaseUrl"), { ...base, nonInteractive: true, env }), "postgres://from-env/db");
  assert.equal(defaultFor(field("databaseUrl"), { ...base, nonInteractive: false, env }), "sqlite://~/.workplane/workplane.db");
  assert.equal(
    defaultFor(field("databaseUrl"), { ...base, nonInteractive: true, env: {}, existing: { DATABASE_URL: "sqlite:///x.db" } }),
    "sqlite:///x.db",
  );
  assert.equal(defaultFor(field("nodeToken"), { ...base, nonInteractive: true, env: {} }), "generated");
});

test("defaultFor derives the server URL from the port resolved earlier", () => {
  assert.equal(
    defaultFor(field("serverUrl"), { nonInteractive: true, env: {}, existing: {}, resolved: { port: "9100" }, generateToken: () => "" }),
    "http://localhost:9100",
  );
});
