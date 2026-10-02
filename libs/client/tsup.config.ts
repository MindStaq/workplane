import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["esm"],
  platform: "neutral",
  target: "es2022",
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["@workplane/types"],
});
