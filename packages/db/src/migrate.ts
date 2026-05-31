import { loadServerConfig } from "../../core/src/config.js";
import { runMigration } from "./migration.js";

async function main(): Promise<void> {
  const config = loadServerConfig();
  await runMigration(config.databaseUrl);
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
