import { config as dotenvConfig } from "dotenv";
import { homedir } from "node:os";
import { join } from "node:path";

let envLoaded = false;

// Load order (highest priority first, all with override:false so shell env vars win):
//   1. .env.local     — project-local overrides (gitignored)
//   2. ~/.workplane/.env — user global config written by workplane-setup
//   3. .env           — project defaults (committed)
export function loadLocalEnv(): void {
  if (envLoaded) {
    return;
  }

  dotenvConfig({ path: ".env.local" });
  dotenvConfig({ path: join(homedir(), ".workplane", ".env") });
  dotenvConfig({ path: ".env" });

  envLoaded = true;
}
