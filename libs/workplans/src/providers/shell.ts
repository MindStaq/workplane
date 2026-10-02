import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface ShellStepOptions {
  command: string;
  cwd?: string;
}

export async function runShellStep(opts: ShellStepOptions): Promise<string> {
  const { stdout } = await execAsync(opts.command, {
    cwd: opts.cwd,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}
