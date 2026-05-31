import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

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
  const existing = parseEnvFile(configPath);
  const isUpdate = existsSync(configPath);

  process.stdout.write("Workplane Setup\n");
  process.stdout.write(
    isUpdate
      ? `Updating config at ${configPath}\n`
      : `Creating config at ${configPath}\n`,
  );
  process.stdout.write("Press Enter to accept the value shown in brackets.\n\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const dbUrl = await ask(
    rl, "DATABASE_URL         ",
    existing.DATABASE_URL ?? "sqlite://~/.workplane/workplane.db",
  );
  const port = await ask(
    rl, "Server port          ",
    existing.WORKPLANE_SERVER_PORT ?? "8787",
  );
  const serverUrl = await ask(
    rl, "Server URL (for nodes)",
    existing.WORKPLANE_SERVER_URL ?? `http://localhost:${port}`,
  );
  const nodeToken = await ask(
    rl, "Node token           ",
    existing.WORKPLANE_NODE_TOKEN ?? generateToken(),
  );
  const operatorToken = await ask(
    rl, "Operator token       ",
    existing.WORKPLANE_OPERATOR_TOKEN ?? generateToken(),
  );

  rl.close();

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

  process.stdout.write("Running migrations...\n");
  const { runMigration } = await import("../../db/src/migration.js");
  await runMigration(dbUrl);

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
