import { config as dotenvConfig } from "dotenv";

let envLoaded = false;

export function loadLocalEnv(): void {
  if (envLoaded) {
    return;
  }

  dotenvConfig({ path: ".env" });
  dotenvConfig({ path: ".env.local" });

  envLoaded = true;
}

