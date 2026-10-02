#!/usr/bin/env node
/**
 * Proves the web app cannot reach server-only code: lints throwaway snippets "as if" they lived in
 * apps/web and libs/ui and asserts that @nx/enforce-module-boundaries rejects each forbidden
 * import, while the allowed imports pass. Nothing is written to disk.
 *
 *   node scripts/check-web-boundaries.mjs
 */
import { ESLint } from "eslint";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const eslint = new ESLint({ cwd: repoRoot });

const cases = [
  { name: "web imports @workplane/db", file: "apps/web/src/probe.ts", code: 'import { createStore } from "@workplane/db";\nexport const x = createStore;\n', ok: false },
  { name: "web imports @workplane/core (Node-only)", file: "apps/web/src/probe.ts", code: 'import { loadServerConfig } from "@workplane/core";\nexport const x = loadServerConfig;\n', ok: false },
  { name: "web imports an adapter", file: "apps/web/src/probe.ts", code: 'import "@workplane/adapter-shell";\n', ok: false },
  { name: "web imports node-pty", file: "apps/web/src/probe.ts", code: 'import "node-pty";\n', ok: false },
  { name: "web imports better-sqlite3", file: "apps/web/src/probe.ts", code: 'import "better-sqlite3";\n', ok: false },
  { name: "web imports another app", file: "apps/web/src/probe.ts", code: 'import "../../server/src/index";\n', ok: false },
  { name: "ui imports @workplane/db", file: "libs/ui/src/probe.ts", code: 'import "@workplane/db";\n', ok: false },
  { name: "web imports @workplane/client", file: "apps/web/src/probe.ts", code: 'import { WorkplaneClient } from "@workplane/client";\nexport const x = WorkplaneClient;\n', ok: true },
  { name: "web imports @workplane/types and @workplane/ui", file: "apps/web/src/probe.ts", code: 'import type { TaskRecord } from "@workplane/types";\nimport { StatusBadge } from "@workplane/ui";\nexport type T = TaskRecord;\nexport const x = StatusBadge;\n', ok: true },
];

let failed = 0;
for (const testCase of cases) {
  const [result] = await eslint.lintText(testCase.code, { filePath: join(repoRoot, testCase.file) });
  const boundaryErrors = result.messages.filter((message) => message.ruleId === "@nx/enforce-module-boundaries");
  const passed = testCase.ok ? boundaryErrors.length === 0 : boundaryErrors.length > 0;
  process.stdout.write(`${passed ? "PASS" : "FAIL"}  ${testCase.name} is ${testCase.ok ? "allowed" : "rejected"}${passed ? "" : ` (got: ${boundaryErrors.map((m) => m.message).join("; ") || "no error"})`}\n`);
  if (!passed) {
    failed += 1;
  }
}
process.stdout.write(`\n${cases.length - failed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
