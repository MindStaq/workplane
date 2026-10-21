import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  entry: { index: "src/index.ts", bin: "src/bin.ts" },
  outDir: "dist",
  format: ["esm"],
  platform: "node",
  target: "node20",
  dts: { entry: { index: "src/index.ts" } },
  // No shared chunk: hashed chunk names would change the pack manifest on every edit.
  splitting: false,
  clean: true,
  sourcemap: true,
  // @workplane/client is private (not published), so it is bundled. Only the MCP SDK and zod stay external.
  external: ["@modelcontextprotocol/sdk", "zod"],
  noExternal: ["@workplane/client", "@workplane/types"],
  define: { __WORKPLANE_MCP_VERSION__: JSON.stringify(version) },
});
