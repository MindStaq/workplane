#!/usr/bin/env node
/**
 * Clean-machine smoke test for the published `workplane` package.
 *
 * Installs the package into a throwaway prefix with a throwaway HOME, runs the first-run wizard,
 * starts the server and a node, then drives the CLI end to end. It only uses Node built-ins and the
 * `npm` binary, so this single file can be copied to any machine with Node >= 20 and run there.
 *
 *   node scripts/smoke-install.mjs --spec workplane@latest     # what is on the npm registry
 *   node scripts/smoke-install.mjs --tarball ./workplane-0.5.0.tgz
 *   node scripts/smoke-install.mjs                              # packs this repo's workplane package
 *
 * Options: --keep (leave the temp dir for inspection), --port <n> (default: a free port)
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `\n      ${detail}`}\n`);
  if (!ok) {
    throw new Error(`smoke check failed: ${name}`);
  }
}

function resolveInstallTarget() {
  const spec = argValue("--spec");
  const tarball = argValue("--tarball");
  if (spec) {
    return { target: spec, label: `registry package ${spec}` };
  }
  if (tarball) {
    return { target: resolve(tarball), label: `tarball ${resolve(tarball)}` };
  }
  const listed = JSON.parse(
    execFileSync("pnpm", ["-r", "ls", "--json", "--depth", "-1"], { cwd: repoRoot, encoding: "utf8", shell: isWindows }),
  );
  const pkg = listed.find((entry) => entry.name === "workplane" && !entry.private && entry.path !== repoRoot);
  if (!pkg) {
    throw new Error("could not find the `workplane` workspace package; pass --spec or --tarball");
  }
  return { packDir: pkg.path, label: `local pack of ${pkg.path}` };
}

async function main() {
  const keep = process.argv.includes("--keep");
  const sandbox = mkdtempSync(join(tmpdir(), "workplane-smoke-"));
  const home = join(sandbox, "home");
  const prefix = join(sandbox, "prefix");
  const work = join(sandbox, "work");
  [home, prefix, work].forEach((dir) => mkdirSync(dir, { recursive: true }));

  const children = [];
  const cleanup = () => {
    for (const child of children) {
      child.kill("SIGTERM");
    }
    if (!keep) {
      rmSync(sandbox, { recursive: true, force: true });
    } else {
      process.stdout.write(`sandbox kept at ${sandbox}\n`);
    }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => process.exit(130));

  try {
    const port = Number(argValue("--port") ?? (await freePort()));
    const serverUrl = `http://127.0.0.1:${port}`;
    const bin = (name) => join(prefix, "node_modules", ".bin", isWindows ? `${name}.cmd` : name);

    // HOME is overridden so ~/.workplane never touches the real user's config.
    const baseEnv = {
      PATH: process.env.PATH,
      HOME: home,
      USERPROFILE: home,
      NODE_ENV: "production",
    };

    const install = resolveInstallTarget();
    process.stdout.write(`Installing ${install.label}\n`);
    let installTarget = install.target;
    if (install.packDir) {
      const out = execFileSync("npm", ["pack", "--pack-destination", sandbox, "--json"], {
        cwd: install.packDir,
        encoding: "utf8",
        shell: isWindows,
      });
      installTarget = join(sandbox, JSON.parse(out)[0].filename);
    }
    execFileSync("npm", ["install", "--prefix", prefix, "--no-audit", "--no-fund", installTarget], {
      stdio: "inherit",
      shell: isWindows,
    });
    for (const name of ["workplane", "workplane-server", "workplane-node", "workplane-db-migrate", "workplane-setup"]) {
      check(`bin installed: ${name}`, existsSync(bin(name)));
    }

    const run = (name, args, extraEnv = {}) =>
      new Promise((resolveRun) => {
        const child = spawn(bin(name), args, { cwd: work, env: { ...baseEnv, ...extraEnv }, shell: isWindows });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => (stdout += chunk));
        child.stderr.on("data", (chunk) => (stderr += chunk));
        child.on("close", (code) => resolveRun({ code, stdout, stderr }));
      });

    // The wizard uses readline prompts, which drop input that arrives before the prompt is shown,
    // so each answer is written only after its prompt appears.
    await new Promise((resolveWizard, rejectWizard) => {
      const wizard = spawn(bin("workplane-setup"), [], { cwd: work, env: baseEnv, shell: isWindows });
      const answers = [
        ["DATABASE_URL", ""],
        ["Server port", String(port)],
        ["Server URL (for nodes)", serverUrl],
        ["Node token", ""],
        ["Operator token", ""],
      ];
      let output = "";
      let next = 0;
      const timer = setTimeout(() => {
        wizard.kill("SIGKILL");
        rejectWizard(new Error(`workplane-setup timed out. Output so far:\n${output}`));
      }, 60_000);
      wizard.stdout.on("data", (chunk) => {
        output += chunk;
        while (next < answers.length) {
          const [label, answer] = answers[next];
          const labelAt = output.indexOf(label);
          const promptEnd = labelAt >= 0 ? output.indexOf("]:", labelAt) : -1;
          if (promptEnd < 0) {
            break;
          }
          wizard.stdin.write(`${answer}\n`);
          output = output.slice(promptEnd + 2);
          next += 1;
        }
      });
      wizard.stderr.on("data", (chunk) => (output += chunk));
      wizard.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0 && output.includes("Ready.")) {
          resolveWizard(undefined);
        } else {
          rejectWizard(new Error(`workplane-setup exited ${code}. Output:\n${output}`));
        }
      });
    });

    const envFile = join(home, ".workplane", ".env");
    check("setup wrote ~/.workplane/.env", existsSync(envFile));
    const config = Object.fromEntries(
      readFileSync(envFile, "utf8")
        .split("\n")
        .filter((line) => line.includes("="))
        .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
    );
    check("setup generated tokens", Boolean(config.WORKPLANE_NODE_TOKEN && config.WORKPLANE_OPERATOR_TOKEN));
    const operatorEnv = { WORKPLANE_SERVER_URL: serverUrl, WORKPLANE_OPERATOR_TOKEN: config.WORKPLANE_OPERATOR_TOKEN };

    const startService = (name, extraEnv = {}) => {
      const child = spawn(bin(name), [], { cwd: work, env: { ...baseEnv, ...extraEnv }, shell: isWindows });
      let log = "";
      child.stdout.on("data", (chunk) => (log += chunk));
      child.stderr.on("data", (chunk) => (log += chunk));
      children.push(child);
      return () => log;
    };
    const serverLog = startService("workplane-server");

    let healthy = false;
    for (let attempt = 0; attempt < 60 && !healthy; attempt += 1) {
      try {
        healthy = (await fetch(`${serverUrl}/healthz`)).ok;
      } catch {
        await sleep(500);
      }
    }
    check("server answers /healthz", healthy, serverLog());

    // workplane-node registers once at startup and exits if the server is not reachable yet.
    const nodeLog = startService("workplane-node", { WORKPLANE_NODE_NAME: "smoke-node", WORKPLANE_POLL_INTERVAL_MS: "500" });

    const unauth = await fetch(`${serverUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "shell.exec", adapter: "shell", payload: { command: "echo nope" } }),
    });
    check("task submit without operator token is rejected (401)", unauth.status === 401, `status ${unauth.status}`);

    const submitted = await run("workplane", ["task", "submit", "shell", "--command", "echo smoke-ok"], operatorEnv);
    check("workplane task submit shell", submitted.code === 0, submitted.stderr);
    const task = JSON.parse(submitted.stdout);

    let finalTask;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      finalTask = await (await fetch(`${serverUrl}/tasks/${task.id}`)).json();
      if (["succeeded", "failed", "cancelled"].includes(finalTask.status)) {
        break;
      }
      await sleep(1000);
    }
    check("node ran the shell task to success", finalTask?.status === "succeeded", `status ${finalTask?.status}\n${nodeLog()}`);

    const { runs } = await (await fetch(`${serverUrl}/runs?taskId=${task.id}`)).json();
    const { logs } = await (await fetch(`${serverUrl}/runs/${runs[0].id}/logs`)).json();
    check("run logs contain the command output", logs.some((entry) => entry.message.includes("smoke-ok")));

    const listed = await run("workplane", ["tasks"], operatorEnv);
    check("workplane tasks lists the task", listed.code === 0 && listed.stdout.includes(task.id), listed.stderr);

    const skills = await run("workplane", ["skill", "list"], operatorEnv);
    check("workplane skill list includes hello", skills.code === 0 && skills.stdout.includes("hello"), skills.stderr);

    const schedule = await run(
      "workplane",
      ["schedule", "create", "hello", "--cron", "0 9 * * *", "--timezone", "UTC", "--input", "message=hello"],
      operatorEnv,
    );
    check("workplane schedule create", schedule.code === 0, schedule.stderr);
    const scheduleList = await run("workplane", ["schedule", "list"], operatorEnv);
    check("workplane schedule list shows the schedule", scheduleList.code === 0 && scheduleList.stdout.includes("hello"), scheduleList.stderr);

    process.stdout.write(`\nAll ${results.length} smoke checks passed against ${install.label}.\n`);
  } finally {
    cleanup();
    process.removeListener("exit", cleanup);
  }
}

main().catch((error) => {
  process.stderr.write(`\n${error.message}\n`);
  process.exit(1);
});
