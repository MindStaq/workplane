#!/usr/bin/env node
/**
 * Publish rehearsal against a throwaway local npm registry (Verdaccio). Nothing here can reach
 * npmjs.org: the work happens in an isolated copy of the working tree whose publishConfig is
 * rewritten to the local registry, with an isolated npm user config and no real tokens.
 *
 * It runs the same tooling as the release workflow (Nx build, `changeset publish` through pnpm):
 *   1. publishes the current versions as the stand-in for "the previous release" (`latest`)
 *   2. adds a patch changeset, enters prerelease mode (`next`), versions and publishes again
 * and then checks the result the way a user would see it:
 *   - `latest` still points at the old version, `next` at the prerelease
 *   - no published manifest contains a `workspace:` range
 *   - the packed CLI installs from the registry and passes scripts/smoke-install.mjs
 *   - the libraries install from the registry and pass scripts/smoke-libs.mjs
 *   - the prerelease and the previous release ship the same code (scripts/dist-compare.mjs)
 *
 *   node scripts/rehearse-publish.mjs [--keep]
 */
import { execFileSync, spawn } from "node:child_process";
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const keep = process.argv.includes("--keep");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sh(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
}

function step(title) {
  process.stdout.write(`\n== ${title}\n`);
}

let checks = 0;
function expect(name, ok, detail = "") {
  checks += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `\n      ${detail}`}\n`);
  if (!ok) {
    throw new Error(`rehearsal check failed: ${name}`);
  }
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

function workspacePackages(cwd) {
  return JSON.parse(sh("pnpm", ["-r", "ls", "--json", "--depth", "-1"], { cwd }))
    .filter((pkg) => pkg.path !== cwd)
    .map((pkg) => ({ ...pkg, manifest: JSON.parse(readFileSync(join(pkg.path, "package.json"), "utf8")) }));
}

async function main() {
  const sandbox = mkdtempSync(join(tmpdir(), "workplane-rehearsal-"));
  let registry;
  process.on("exit", () => {
    registry?.kill("SIGTERM");
    if (keep) {
      process.stdout.write(`\nsandbox kept at ${sandbox}\n`);
    } else {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  step("Start a local registry");
  const port = await freePort();
  const registryUrl = `http://127.0.0.1:${port}/`;
  const verdaccioDir = join(sandbox, "verdaccio");
  mkdirSync(verdaccioDir, { recursive: true });
  // Our own package names are not proxied upstream, so the registry looks empty to Changesets and
  // everything is published. Third-party dependencies are proxied so installs still resolve.
  writeFileSync(
    join(verdaccioDir, "config.yaml"),
    [
      `storage: ${join(verdaccioDir, "storage")}`,
      "auth:",
      "  htpasswd:",
      `    file: ${join(verdaccioDir, "htpasswd")}`,
      "uplinks:",
      "  npmjs:",
      "    url: https://registry.npmjs.org/",
      "packages:",
      "  '@workplane/*':",
      "    access: $all",
      "    publish: $all",
      "    unpublish: $all",
      "  'workplane':",
      "    access: $all",
      "    publish: $all",
      "    unpublish: $all",
      "  '**':",
      "    access: $all",
      "    proxy: npmjs",
      "log: { type: stdout, format: pretty, level: warn }",
      "",
    ].join("\n"),
  );
  registry = spawn(join(repoRoot, "node_modules", ".bin", "verdaccio"), ["--config", join(verdaccioDir, "config.yaml"), "--listen", `127.0.0.1:${port}`], {
    stdio: "ignore",
  });
  let up = false;
  for (let attempt = 0; attempt < 60 && !up; attempt += 1) {
    try {
      up = (await fetch(`${registryUrl}-/ping`)).ok;
    } catch {
      await sleep(500);
    }
  }
  expect(`local registry is up at ${registryUrl}`, up);

  step("Create an isolated copy of the working tree");
  const copy = join(sandbox, "repo");
  mkdirSync(copy, { recursive: true });
  const tracked = sh("git", ["ls-files", "-z", "-co", "--exclude-standard"], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 })
    .split("\0")
    .filter(Boolean);
  for (const file of tracked) {
    const source = join(repoRoot, file);
    if (existsSync(source)) {
      mkdirSync(dirname(join(copy, file)), { recursive: true });
      cpSync(source, join(copy, file));
    }
  }
  for (const pkg of workspacePackages(repoRoot).filter((p) => !p.manifest.private)) {
    const manifestPath = join(copy, pkg.path.slice(repoRoot.length + 1), "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.publishConfig = { ...(manifest.publishConfig ?? {}), registry: registryUrl };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const stillNpmjs = readdirSync(copy, { recursive: true })
    .filter((entry) => String(entry).endsWith("package.json") && !String(entry).includes("node_modules"))
    .filter((entry) => readFileSync(join(copy, String(entry)), "utf8").includes("registry.npmjs.org"));
  expect("no package in the copy can publish to npmjs.org", stillNpmjs.length === 0, stillNpmjs.join(", "));

  const gitEnv = { ...process.env, GIT_AUTHOR_NAME: "rehearsal", GIT_AUTHOR_EMAIL: "r@example.com", GIT_COMMITTER_NAME: "rehearsal", GIT_COMMITTER_EMAIL: "r@example.com" };
  sh("git", ["init", "-q", "-b", "main"], { cwd: copy, env: gitEnv });
  sh("git", ["add", "-A"], { cwd: copy, env: gitEnv });
  sh("git", ["commit", "-q", "-m", "rehearsal"], { cwd: copy, env: gitEnv });

  step("Install and build with Nx (no cache)");
  const cleanEnv = { ...process.env, NX_DAEMON: "false" };
  delete cleanEnv.NPM_TOKEN;
  delete cleanEnv.NODE_AUTH_TOKEN;
  sh("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], { cwd: copy, env: cleanEnv });
  const build = () => sh("pnpm", ["exec", "nx", "run-many", "-t", "build", "--skip-nx-cache"], { cwd: copy, env: cleanEnv });
  build();
  expect("nx build succeeded", true);

  const npmrc = join(sandbox, "rehearsal.npmrc");
  writeFileSync(npmrc, `registry=${registryUrl}\n//127.0.0.1:${port}/:_authToken=rehearsal\n`);
  const publishEnv = {
    ...cleanEnv,
    NPM_CONFIG_USERCONFIG: npmrc,
    npm_config_userconfig: npmrc,
    NPM_CONFIG_REGISTRY: registryUrl,
    npm_config_registry: registryUrl,
    NODE_AUTH_TOKEN: "rehearsal",
  };

  const publicPackages = workspacePackages(copy).filter((p) => !p.manifest.private);
  const cli = publicPackages.find((p) => p.name === "workplane");
  const previousVersion = cli.manifest.version;

  step(`Publish ${publicPackages.length} packages at ${previousVersion} (stand-in for the previous release)`);
  const first = sh("pnpm", ["changeset", "publish", "--no-git-tag"], { cwd: copy, env: publishEnv });
  const publishedCount = [...first.matchAll(/packages published successfully|Publishing "/g)].length;
  expect("changeset publish ran", publishedCount > 0, first.slice(-600));
  const latestOf = (name) => JSON.parse(sh("npm", ["view", name, "dist-tags", "--json"], { env: publishEnv }));
  expect(`workplane@latest is ${previousVersion}`, latestOf("workplane").latest === previousVersion);

  step("Add a changeset, enter prerelease mode (next), version and publish");
  const names = publicPackages.map((p) => `"${p.name}": patch`).join("\n");
  writeFileSync(join(copy, ".changeset", "rehearsal-restructure.md"), `---\n${names}\n---\n\nRehearsal: build and repository restructure, no functional change.\n`);
  sh("pnpm", ["changeset", "pre", "enter", "next"], { cwd: copy, env: publishEnv });
  sh("pnpm", ["changeset", "version"], { cwd: copy, env: publishEnv });
  const nextVersion = JSON.parse(readFileSync(join(cli.path, "package.json"), "utf8")).version;
  expect(`versioned to a prerelease (${nextVersion})`, /-next\.\d+$/.test(nextVersion));
  sh("pnpm", ["install", "--no-frozen-lockfile", "--prefer-offline"], { cwd: copy, env: cleanEnv });
  build();
  sh("pnpm", ["changeset", "publish", "--no-git-tag"], { cwd: copy, env: publishEnv });

  step("Verify what a user would see");
  for (const pkg of publicPackages) {
    const tags = latestOf(pkg.name);
    expect(`${pkg.name}: latest=${previousVersion}, next=${nextVersion}`, tags.latest === previousVersion && tags.next === nextVersion, JSON.stringify(tags));
    const published = JSON.parse(sh("npm", ["view", `${pkg.name}@${nextVersion}`, "--json"], { env: publishEnv }));
    const ranges = JSON.stringify({ d: published.dependencies, p: published.peerDependencies, o: published.optionalDependencies });
    expect(`${pkg.name}: no workspace: ranges in the published manifest`, !ranges.includes("workspace:"), ranges);
  }

  step("Install the prerelease from the registry and run the clean-machine tests");
  const registryEnv = { ...process.env, npm_config_registry: registryUrl, NPM_CONFIG_REGISTRY: registryUrl };
  const smoke = (script, args) => {
    const out = sh("node", [join(repoRoot, "scripts", script), ...args], { cwd: repoRoot, env: registryEnv, maxBuffer: 64 * 1024 * 1024 });
    return out.trim().split("\n").slice(-2).join(" | ");
  };
  expect("smoke-install against workplane@next", /passed/.test(smoke("smoke-install.mjs", ["--spec", "workplane@next"])), "");
  expect(`smoke-install against workplane@${previousVersion}`, /passed/.test(smoke("smoke-install.mjs", ["--spec", `workplane@${previousVersion}`])), "");
  expect("smoke-libs against the prerelease libraries", /0 failed/.test(smoke("smoke-libs.mjs", ["--version", nextVersion])), "");

  step("Compare the prerelease with the previous release");
  const extract = (spec, name) => {
    const dir = join(sandbox, name);
    mkdirSync(dir, { recursive: true });
    const tarball = JSON.parse(sh("npm", ["pack", spec, "--pack-destination", dir, "--json"], { env: publishEnv }))[0].filename;
    sh("tar", ["-xzf", join(dir, tarball), "-C", dir]);
    return join(dir, "package");
  };
  const previous = extract(`workplane@${previousVersion}`, "previous");
  const next = extract(`workplane@${nextVersion}`, "next");
  const compare = sh("node", [join(repoRoot, "scripts", "dist-compare.mjs"), join(previous, "dist"), join(next, "dist")], { cwd: repoRoot });
  expect("prerelease dist is identical to the previous release dist", /, 0 different/.test(compare), compare);

  process.stdout.write(`\nRehearsal passed (${checks} checks). Nothing was sent to npmjs.org.\n`);
}

main().catch((error) => {
  process.stderr.write(`\n${error.stdout ? `${error.stdout}\n` : ""}${error.stderr ? `${error.stderr}\n` : ""}${error.message}\n`);
  process.exit(1);
});
