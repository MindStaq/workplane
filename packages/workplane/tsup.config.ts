import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageRoot, "../..");

export default defineConfig({
  entry: {
    cli: resolve(repoRoot, "packages/cli/src/index.ts"),
    server: resolve(repoRoot, "packages/server/src/index.ts"),
    node: resolve(repoRoot, "packages/node/src/index.ts"),
    migrate: resolve(repoRoot, "packages/db/src/migrate.ts"),
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
  external: ["pg", "@dbos-inc/dbos-sdk", "dotenv", "zod"],
  onSuccess: async () => {
    const distDir = resolve(packageRoot, "dist");
    mkdirSync(distDir, { recursive: true });
    copyFileSync(resolve(repoRoot, "packages/db/src/schema.sql"), resolve(distDir, "schema.sql"));
  },
});
