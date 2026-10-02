import { defineConfig } from "@playwright/test";

const webPort = 3100;
const serverPort = 8791;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${webPort}`,
    // Uses the Chrome already installed on developer machines and GitHub runners; no browser download.
    channel: "chrome",
  },
  webServer: {
    command: "node scripts/dev-all.mjs --seed --reset --db .workplane/e2e/e2e.db --no-node",
    cwd: "../..",
    url: `http://localhost:${webPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      WORKPLANE_SERVER_PORT: String(serverPort),
      WEB_PORT: String(webPort),
      WORKPLANE_SCHEDULER_ENABLED: "false",
    },
  },
});
