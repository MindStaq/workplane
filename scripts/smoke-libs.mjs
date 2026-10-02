#!/usr/bin/env node
/**
 * Consumer smoke test for the published @workplane/* libraries.
 *
 * Installs every public library into a throwaway project (the way a user would), then checks:
 *   1. each library can be imported as an ES module and exports something sensible
 *   2. every bare import in each library's dist/*.js and dist/*.d.ts is a declared dependency
 *      or peer dependency (a missing declaration works inside this monorepo and breaks for users)
 *   3. a TypeScript consumer file importing every library type-checks
 *
 *   node scripts/smoke-libs.mjs                      # pack and test this repo's libraries
 *   node scripts/smoke-libs.mjs --version 0.4.3      # test what is on the npm registry
 *
 * Options: --keep (leave the temp dir for inspection)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const knownIssues = JSON.parse(readFileSync(join(repoRoot, "scripts", "smoke-libs.known-issues.json"), "utf8"));
const builtins = new Set(builtinModules.map((name) => name.replace(/^node:/, "").split("/")[0]));

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const failures = [];
let passed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    process.stdout.write(`PASS  ${name}\n`);
  } else {
    failures.push(name);
    process.stdout.write(`FAIL  ${name}${detail ? `\n      ${detail.split("\n").join("\n      ")}` : ""}\n`);
  }
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", shell: isWindows, ...options });
}

function listPublicLibraries() {
  const all = JSON.parse(run("pnpm", ["-r", "ls", "--json", "--depth", "-1"], { cwd: repoRoot }));
  return all
    .filter((pkg) => !pkg.private && pkg.path !== repoRoot && pkg.name.startsWith("@workplane/"))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function walkFiles(dir, accept) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkFiles(full, accept));
    } else if (accept(entry)) {
      out.push(full);
    }
  }
  return out;
}

function packageNameOf(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function bareSpecifiers(source) {
  const found = new Set();
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /^\s*import\s*["']([^"']+)["']/gm,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (!specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("node:")) {
        found.add(packageNameOf(specifier));
      }
    }
  }
  return [...found].filter((name) => !builtins.has(name));
}

function main() {
  const sandbox = mkdtempSync(join(tmpdir(), "workplane-libs-smoke-"));
  const keep = process.argv.includes("--keep");
  const version = argValue("--version");
  process.on("exit", () => {
    if (keep) {
      process.stdout.write(`sandbox kept at ${sandbox}\n`);
    } else {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  let names;
  let installArgs;
  if (version) {
    names = listPublicLibraries().map((pkg) => pkg.name);
    installArgs = names.map((name) => `${name}@${version}`);
    process.stdout.write(`Testing ${names.length} libraries from the npm registry at ${version}\n`);
  } else {
    const libraries = listPublicLibraries();
    names = libraries.map((pkg) => pkg.name);
    process.stdout.write(`Packing ${libraries.length} libraries from this repo\n`);
    installArgs = libraries.map((pkg) => {
      // pnpm pack, not npm pack: releases publish through pnpm, which rewrites workspace: ranges.
      const out = run("pnpm", ["pack", "--pack-destination", sandbox, "--json"], { cwd: pkg.path });
      return JSON.parse(out).filename;
    });
  }

  const project = join(sandbox, "consumer");
  mkdirSync(project, { recursive: true });
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "consumer", private: true, type: "module" }));
  process.stdout.write("Installing into a clean project\n");
  run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error", ...installArgs], { cwd: project, stdio: "inherit" });

  for (const name of names) {
    const dir = join(project, "node_modules", name);
    if (!existsSync(dir)) {
      check(`${name}: installed`, false);
      continue;
    }
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const declared = new Set([
      name,
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
    ]);

    const files = existsSync(join(dir, "dist"))
      ? walkFiles(join(dir, "dist"), (file) => file.endsWith(".js") || file.endsWith(".d.ts"))
      : [];
    const undeclared = new Set();
    for (const file of files) {
      for (const specifier of bareSpecifiers(readFileSync(file, "utf8"))) {
        if (!declared.has(specifier)) {
          undeclared.add(`${specifier} (in ${file.slice(dir.length + 1)})`);
        }
      }
    }
    const known = new Set(knownIssues[name] ?? []);
    const unexpected = [...undeclared].filter((entry) => !known.has(entry.split(" ")[0]));
    check(
      `${name}: every imported package is a declared dependency`,
      unexpected.length === 0,
      `undeclared: ${unexpected.join(", ")}`,
    );
    const stillPresent = new Set([...undeclared].map((entry) => entry.split(" ")[0]));
    for (const specifier of known) {
      process.stdout.write(
        stillPresent.has(specifier)
          ? `KNOWN ${name}: ${specifier} is imported but not declared (tolerated, see scripts/smoke-libs.known-issues.json)\n`
          : `NOTE  ${name}: ${specifier} is no longer undeclared; remove it from scripts/smoke-libs.known-issues.json\n`,
      );
    }
  }

  const importScript = `
    const names = ${JSON.stringify(names)};
    const out = {};
    for (const name of names) {
      try {
        const mod = await import(name);
        out[name] = { ok: true, exports: Object.keys(mod).length };
      } catch (error) {
        out[name] = { ok: false, error: String(error && error.message || error).split("\\n")[0] };
      }
    }
    console.log(JSON.stringify(out));
  `;
  const imported = JSON.parse(run("node", ["--input-type=module", "-e", importScript], { cwd: project }).trim().split("\n").pop());
  for (const name of names) {
    const result = imported[name];
    check(`${name}: imports as an ES module`, Boolean(result?.ok), result?.error);
  }

  const typescript = join(repoRoot, "node_modules", "typescript", "bin", "tsc");
  if (!existsSync(typescript)) {
    check("TypeScript consumer compiles", false, "typescript is not installed in this repo; run pnpm install");
  } else {
    writeFileSync(
      join(project, "consumer.ts"),
      `${names.map((name, index) => `import * as lib${index} from "${name}";`).join("\n")}\nexport const all = [${names.map((_, index) => `lib${index}`).join(", ")}];\n`,
    );
    writeFileSync(
      join(project, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          types: [],
        },
        files: ["consumer.ts"],
      }),
    );
    try {
      run("node", [typescript, "-p", "tsconfig.json"], { cwd: project, stdio: "pipe" });
      check("TypeScript consumer importing every library compiles", true);
    } catch (error) {
      check("TypeScript consumer importing every library compiles", false, String(error.stdout ?? error.message));
    }
  }

  process.stdout.write(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
