import type { WorkAdapter } from "../../adapter-sdk/src/index.js";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";

interface ShellPayload {
  command: string;
  args?: string[];
  cwd?: string;
}

export const shellAdapter: WorkAdapter<ShellPayload> = {
  name: "shell",
  kind: "shell.exec",
  async run(context, payload) {
    const renderedCommand = payload.args && payload.args.length > 0 ? `${payload.command} ${payload.args.join(" ")}` : payload.command;
    const commandCwd = payload.cwd
      ? payload.cwd.startsWith("/")
        ? payload.cwd
        : join(context.workspacePath, payload.cwd)
      : context.workspacePath;
    const result = await context.exec("/bin/sh", ["-lc", renderedCommand], { cwd: commandCwd });
    const artifactsDir = await context.ensureWorkspace("artifacts");
    const resultPath = join(artifactsDir, "shell-result.json");
    await writeFile(
      resultPath,
      JSON.stringify(
        {
          command: renderedCommand,
          cwd: commandCwd,
          exitCode: result.exitCode,
        },
        null,
        2,
      ),
      "utf8",
    );
    await context.emitArtifact({
      type: "shell.result",
      name: "shell-result.json",
      path: resultPath,
      metadata: { exitCode: result.exitCode },
    });
    if (result.exitCode !== 0) {
      throw new Error(`shell command failed with exit code ${result.exitCode}`);
    }
  },
};
