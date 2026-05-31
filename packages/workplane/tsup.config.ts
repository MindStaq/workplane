import { copyFileSync, cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageRoot, "../..");

// Resolve @workplane/* to TypeScript source so the bundle never depends on dist/ builds.
const workplaneAlias: Record<string, string> = {
  "@workplane/types": resolve(repoRoot, "packages/types/src/index.ts"),
  "@workplane/core": resolve(repoRoot, "packages/core/src/index.ts"),
  "@workplane/adapter-sdk": resolve(repoRoot, "packages/adapter-sdk/src/index.ts"),
  "@workplane/adapter-shell": resolve(repoRoot, "packages/adapter-shell/src/index.ts"),
  "@workplane/adapter-aider": resolve(repoRoot, "packages/adapter-aider/src/index.ts"),
  "@workplane/adapter-ollama": resolve(repoRoot, "packages/adapter-ollama/src/index.ts"),
  "@workplane/adapter-harness": resolve(repoRoot, "packages/adapter-harness/src/index.ts"),
  "@workplane/adapter-claude-code": resolve(repoRoot, "packages/adapter-claude-code/src/index.ts"),
  "@workplane/adapter-codex": resolve(repoRoot, "packages/adapter-codex/src/index.ts"),
  "@workplane/workplans": resolve(repoRoot, "packages/workplans/src/index.ts"),
  "@workplane/agent-skills": resolve(repoRoot, "packages/agent-skills/src/index.ts"),
  "@workplane/dbos": resolve(repoRoot, "packages/dbos/src/index.ts"),
};

export default defineConfig({
  entry: {
    cli: resolve(repoRoot, "packages/cli/src/index.ts"),
    server: resolve(repoRoot, "packages/server/src/index.ts"),
    node: resolve(repoRoot, "packages/node/src/index.ts"),
    migrate: resolve(repoRoot, "packages/db/src/migrate.ts"),
    setup: resolve(repoRoot, "packages/cli/src/setup.ts"),
  },
  outDir: "dist",
  format: ["esm"],
  platform: "node",
  target: "node20",
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  bundle: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  external: ["pg", "better-sqlite3", "@dbos-inc/dbos-sdk", "dotenv", "zod", "node-pty", "@anthropic-ai/sdk", "openai", "ollama", "cron-parser"],
  esbuildOptions(options) {
    options.alias = workplaneAlias;
  },
  onSuccess: async () => {
    const distDir = resolve(packageRoot, "dist");
    mkdirSync(distDir, { recursive: true });
    cpSync(
      resolve(repoRoot, "packages/db/src/migrations"),
      resolve(distDir, "migrations"),
      { recursive: true },
    );
    // Keep raw SQL files for reference / manual inspection
    copyFileSync(resolve(repoRoot, "packages/db/src/schema.sql"), resolve(distDir, "schema.sql"));
    copyFileSync(resolve(repoRoot, "packages/db/src/schema.sqlite.sql"), resolve(distDir, "schema.sqlite.sql"));
  },
});
