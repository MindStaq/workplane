/**
 * Pack manifest guard.
 *
 * Records which files `npm pack` would publish for every public workspace package and compares
 * them with a committed snapshot, so restructuring the repo (Nx migration, moved directories,
 * changed build output) cannot silently change what ships to npm.
 *
 * The snapshot is keyed by package name, not by directory, so it stays valid when packages move.
 * Only file paths are compared (not sizes or hashes) because sourcemaps and bundles legitimately
 * change between builds.
 *
 * Usage (build first: `pnpm build:libs && pnpm build`):
 *   node --import tsx scripts/pack-manifest.ts            # check against the snapshot
 *   node --import tsx scripts/pack-manifest.ts --write    # regenerate the snapshot
 *   node --import tsx scripts/pack-manifest.ts --only workplane
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = resolve(repoRoot, "scripts/pack-manifest.snapshot.json");

interface WorkspacePackage {
  name: string;
  path: string;
  private?: boolean;
}

interface PackageJson {
  name: string;
  main?: string;
  types?: string;
  bin?: string | Record<string, string>;
  exports?: unknown;
}

type Snapshot = Record<string, string[]>;

function listPublicPackages(): WorkspacePackage[] {
  const out = execFileSync("pnpm", ["-r", "ls", "--json", "--depth", "-1"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const all = JSON.parse(out) as WorkspacePackage[];
  return all
    .filter((pkg) => pkg.path !== repoRoot && !pkg.private)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function packedFiles(pkg: WorkspacePackage): string[] {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: pkg.path,
    encoding: "utf8",
  });
  const [result] = JSON.parse(out) as Array<{ files: Array<{ path: string }> }>;
  return result.files.map((file) => file.path).sort();
}

function collectExportTargets(value: unknown, into: Set<string>): void {
  if (typeof value === "string") {
    into.add(value);
  } else if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      collectExportTargets(child, into);
    }
  }
}

/** Every file a package.json points at (main, types, bin, exports) must be inside the tarball. */
function missingEntryPoints(pkg: WorkspacePackage, files: string[]): string[] {
  const manifest = JSON.parse(readFileSync(resolve(pkg.path, "package.json"), "utf8")) as PackageJson;
  const targets = new Set<string>();
  for (const field of [manifest.main, manifest.types]) {
    if (field) {
      targets.add(field);
    }
  }
  if (typeof manifest.bin === "string") {
    targets.add(manifest.bin);
  } else if (manifest.bin) {
    Object.values(manifest.bin).forEach((target) => targets.add(target));
  }
  collectExportTargets(manifest.exports, targets);

  const packed = new Set(files);
  return [...targets]
    .map((target) => target.replace(/^\.\//, ""))
    .filter((target) => !packed.has(target))
    .sort();
}

function diff(expected: string[], actual: string[]): { added: string[]; removed: string[] } {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    added: actual.filter((file) => !expectedSet.has(file)),
    removed: expected.filter((file) => !actualSet.has(file)),
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const onlyIndex = args.indexOf("--only");
  const only = onlyIndex >= 0 ? args[onlyIndex + 1] : undefined;

  const packages = listPublicPackages().filter((pkg) => !only || pkg.name === only);
  if (packages.length === 0) {
    throw new Error(only ? `no public package named ${only}` : "no public packages found");
  }

  const current: Snapshot = {};
  const problems: string[] = [];

  for (const pkg of packages) {
    const files = packedFiles(pkg);
    current[pkg.name] = files;
    const missing = missingEntryPoints(pkg, files);
    if (missing.length > 0) {
      problems.push(`${pkg.name}: package.json entry points missing from tarball (is dist/ built?): ${missing.join(", ")}`);
    }
  }

  if (write) {
    if (problems.length > 0) {
      process.stderr.write(`${problems.join("\n")}\nrefusing to write a snapshot from an incomplete build\n`);
      process.exit(1);
    }
    const existing: Snapshot = existsSync(snapshotPath) ? (JSON.parse(readFileSync(snapshotPath, "utf8")) as Snapshot) : {};
    const next = only ? { ...existing, ...current } : current;
    const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(snapshotPath, `${JSON.stringify(sorted, null, 2)}\n`);
    process.stdout.write(`wrote ${snapshotPath} (${Object.keys(sorted).length} packages)\n`);
    return;
  }

  if (!existsSync(snapshotPath)) {
    throw new Error(`no snapshot at ${snapshotPath}; run with --write after a known-good build`);
  }
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as Snapshot;

  for (const [name, files] of Object.entries(current)) {
    const expected = snapshot[name];
    if (!expected) {
      problems.push(`${name}: public package has no entry in the snapshot (new package? run with --write)`);
      continue;
    }
    const { added, removed } = diff(expected, files);
    if (added.length > 0) {
      problems.push(`${name}: files now published that were not before:\n    + ${added.join("\n    + ")}`);
    }
    if (removed.length > 0) {
      problems.push(`${name}: files no longer published:\n    - ${removed.join("\n    - ")}`);
    }
  }

  if (!only) {
    for (const name of Object.keys(snapshot)) {
      if (!(name in current)) {
        problems.push(`${name}: in snapshot but no longer a public workspace package`);
      }
    }
  }

  if (problems.length > 0) {
    process.stderr.write(`pack manifest check FAILED\n${problems.map((p) => `  ${p}`).join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write(`pack manifest OK (${packages.length} packages match the snapshot)\n`);
}

main();
