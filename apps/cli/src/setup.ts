import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { defaultFor, parseSetupArgs, SETUP_FIELDS, SETUP_HELP, type SetupKey } from "./setup-options.js";

const workplaneDir = join(homedir(), ".workplane");
const configPath = join(workplaneDir, ".env");

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function parseEnvFile(path: string): Record<string, string> {
  try {
    const result: Record<string, string> = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq !== -1) result[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
    return result;
  } catch {
    return {};
  }
}

async function ask(
  rl: Awaited<ReturnType<typeof createInterface>>,
  label: string,
  def: string,
): Promise<string> {
  const answer = await rl.question(`  ${label} [${def}]: `);
  return answer.trim() || def;
}

async function main(): Promise<void> {
  const args = parseSetupArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(SETUP_HELP);
    return;
  }
  // Explicit only: scripts that pipe answers into the prompts (smoke:install does) must keep working.
  const nonInteractive = args.nonInteractive;
  const existing = parseEnvFile(configPath);
  const isUpdate = existsSync(configPath);

  process.stdout.write("Workplane Setup\n");
  process.stdout.write(
    isUpdate
      ? `Updating config at ${configPath}\n`
      : `Creating config at ${configPath}\n`,
  );
  if (!nonInteractive) {
    process.stdout.write("Press Enter to accept the value shown in brackets.\n\n");
  }

  const rl = nonInteractive ? undefined : createInterface({ input: process.stdin, output: process.stdout });
  const resolved: Partial<Record<SetupKey, string>> = {};
  for (const field of SETUP_FIELDS) {
    const given = args.values[field.key];
    if (given !== undefined) {
      resolved[field.key] = given;
      continue;
    }
    const def = defaultFor(field, { nonInteractive, env: process.env, existing, resolved, generateToken });
    resolved[field.key] = rl ? await ask(rl, field.label, def) : def;
  }
  rl?.close();

  const dbUrl = resolved.databaseUrl as string;
  const port = resolved.port as string;
  const serverUrl = resolved.serverUrl as string;
  const nodeToken = resolved.nodeToken as string;
  const operatorToken = resolved.operatorToken as string;

  const config = [
    `DATABASE_URL=${dbUrl}`,
    `WORKPLANE_SERVER_PORT=${port}`,
    `WORKPLANE_SERVER_URL=${serverUrl}`,
    `WORKPLANE_NODE_TOKEN=${nodeToken}`,
    `WORKPLANE_OPERATOR_TOKEN=${operatorToken}`,
  ].join("\n") + "\n";

  mkdirSync(workplaneDir, { recursive: true });
  writeFileSync(configPath, config);
  process.stdout.write(`\nConfig saved: ${configPath}\n`);

  if (args.migrate) {
    process.stdout.write("Running migrations...\n");
    const { runMigration } = await import("@workplane/db/migration");
    await runMigration(dbUrl);
  } else {
    process.stdout.write("Skipping migrations (--no-migrate); run workplane-db-migrate before starting the server.\n");
  }

  process.stdout.write(`
Ready. Start your fleet:

  workplane-server    # control plane
  workplane-node      # worker (this machine or another)
  workplane tasks     # inspect submitted work

Tokens for remote machines:
  WORKPLANE_NODE_TOKEN=${nodeToken}
  WORKPLANE_OPERATOR_TOKEN=${operatorToken}
`);
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
