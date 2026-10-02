#!/usr/bin/env node
/**
 * Compare two build output trees (for example a published package and a fresh local build) and
 * report whether they ship the same code.
 *
 *   node scripts/dist-compare.mjs <dirA> <dirB>
 *
 * Per file the result is one of:
 *   identical  byte for byte the same
 *   reordered  a JavaScript bundle containing exactly the same lines in a different order.
 *              Bundlers order modules by import order, which legitimately changes when imports
 *              are rewritten. Blank lines and `// <path>` source-marker comments are ignored
 *              because they embed the (moving) source locations.
 *   DIFFERENT  anything else, including files present on only one side
 * Source maps (*.map) are skipped: they embed source paths and change whenever files move.
 * Exits non-zero if any file is DIFFERENT.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (!entry.endsWith(".map")) {
        out.push(relative(root, full));
      }
    }
  };
  walk(root);
  return out.sort();
}

// esbuild labels lazily initialised modules with their source path, e.g.
// `"../../libs/core/src/env.ts"() {`. The label changes when a file moves; the code does not.
const MODULE_LABEL = /"(?:\.\.\/)+(?:(?:libs|apps|packages)\/)?([\w-]+\/src\/[^"]*\.ts)"/g;

function codeLines(text) {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "" && !/^\/\/ \S/.test(line))
    .map((line) => line.replace(MODULE_LABEL, '"$1"'))
    .sort();
}

const [dirA, dirB] = process.argv.slice(2).map((dir) => resolve(dir));
if (!dirA || !dirB) {
  process.stderr.write("usage: node scripts/dist-compare.mjs <dirA> <dirB>\n");
  process.exit(2);
}

const filesA = new Set(listFiles(dirA));
const filesB = new Set(listFiles(dirB));
let different = 0;
const counts = { identical: 0, reordered: 0 };

for (const file of [...new Set([...filesA, ...filesB])].sort()) {
  if (!filesA.has(file) || !filesB.has(file)) {
    process.stdout.write(`DIFFERENT  ${file} (only in ${filesA.has(file) ? "A" : "B"})\n`);
    different += 1;
    continue;
  }
  const a = readFileSync(join(dirA, file));
  const b = readFileSync(join(dirB, file));
  if (a.equals(b)) {
    counts.identical += 1;
    continue;
  }
  if (file.endsWith(".js") && JSON.stringify(codeLines(a.toString("utf8"))) === JSON.stringify(codeLines(b.toString("utf8")))) {
    process.stdout.write(`reordered  ${file}\n`);
    counts.reordered += 1;
    continue;
  }
  process.stdout.write(`DIFFERENT  ${file}\n`);
  different += 1;
}

process.stdout.write(`\n${counts.identical} identical, ${counts.reordered} reordered, ${different} different\n`);
process.exit(different === 0 ? 0 : 1);
