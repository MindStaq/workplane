import { copyFileSync, cpSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageRoot, "../..");

// Resolve @workplane/* to TypeScript source so the bundle never depends on dist/ builds.
// The table is read from tsconfig.base.json so the bundle and the type checker cannot disagree.
const tsconfigBase = JSON.parse(readFileSync(resolve(repoRoot, "tsconfig.base.json"), "utf8")) as {
  compilerOptions: { paths: Record<string, string[]> };
};
const workplaneAlias: Record<string, string> = Object.fromEntries(
  Object.entries(tsconfigBase.compilerOptions.paths).map(([name, [target]]) => [name, resolve(repoRoot, target)]),
);

export default defineConfig({
  entry: {
    cli: resolve(repoRoot, "apps/cli/src/index.ts"),
    server: resolve(repoRoot, "apps/server/src/index.ts"),
    node: resolve(repoRoot, "apps/node/src/index.ts"),
    migrate: resolve(repoRoot, "libs/db/src/migrate.ts"),
    setup: resolve(repoRoot, "apps/cli/src/setup.ts"),
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
      resolve(repoRoot, "libs/db/src/migrations"),
      resolve(distDir, "migrations"),
      { recursive: true },
    );
    // Keep raw SQL files for reference / manual inspection
    copyFileSync(resolve(repoRoot, "libs/db/src/schema.sql"), resolve(distDir, "schema.sql"));
    copyFileSync(resolve(repoRoot, "libs/db/src/schema.sqlite.sql"), resolve(distDir, "schema.sqlite.sql"));
  },
});
