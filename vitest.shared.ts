import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Vite aliases derived from tsconfig.base.json `paths`, so tests resolve `@workplane/*` like the apps do. */
export function workspaceAliases(): Array<{ find: RegExp; replacement: string }> {
  const root = fileURLToPath(new URL(".", import.meta.url));
  const { compilerOptions } = JSON.parse(readFileSync(`${root}tsconfig.base.json`, "utf8")) as {
    compilerOptions: { paths: Record<string, string[]> };
  };
  return Object.entries(compilerOptions.paths).map(([name, [target]]) => ({
    find: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`),
    replacement: `${root}${target.replace(/^\.\//, "")}`,
  }));
}
