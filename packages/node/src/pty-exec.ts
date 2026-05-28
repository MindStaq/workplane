import * as pty from "node-pty";
import type { WorkContext } from "../../adapter-sdk/src/index.js";
import { pickNodeEnv } from "./env.js";

// Covers CSI (colors, cursor), OSC (window title), and simple ESC sequences.
const ANSI_RE = /\x1b(?:[@-Z\\-_]|\[[0-9;?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\))/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

export function createPtyExec(context: WorkContext): {
  exec: WorkContext["exec"];
  kill: (signal?: NodeJS.Signals) => void;
  writeStdin: (data: string) => void;
  ptyResize: (rows: number, cols: number) => void;
} {
  let activePty: pty.IPty | undefined;
  let killTimer: ReturnType<typeof setTimeout> | undefined;

  const exec: WorkContext["exec"] = async (command, args = [], options = {}) =>
    new Promise((resolve) => {
      const env = {
        ...pickNodeEnv(context.envAllowlist),
        ...(options.env ?? {}),
        TERM: "xterm-256color",
      };

      const terminal = pty.spawn(command, args, {
        cwd: options.cwd ?? context.workspacePath,
        env,
        cols: 220,
        rows: 50,
      });
      activePty = terminal;

      let output = "";

      terminal.onData((chunk) => {
        const stripped = stripAnsi(chunk);
        output += stripped;
        void context.log("stdout", stripped);
      });

      terminal.onExit(({ exitCode, signal: exitSignal }) => {
        activePty = undefined;
        if (killTimer !== undefined) {
          clearTimeout(killTimer);
          killTimer = undefined;
        }
        const terminated = exitSignal !== undefined && exitSignal !== 0;
        resolve({
          exitCode: terminated ? 1 : (exitCode ?? 0),
          stdout: output,
          stderr: terminated ? `process terminated (signal ${exitSignal})` : "",
        });
      });
    });

  const kill = (signal: NodeJS.Signals = "SIGTERM"): void => {
    if (!activePty) return;
    activePty.kill(signal);
    if (signal === "SIGTERM" && killTimer === undefined) {
      killTimer = setTimeout(() => {
        if (activePty) {
          activePty.kill("SIGKILL");
          activePty = undefined;
        }
        killTimer = undefined;
      }, 5000);
    }
  };

  const writeStdin = (data: string): void => {
    if (activePty) {
      activePty.write(data);
    }
  };

  const ptyResize = (rows: number, cols: number): void => {
    if (activePty) {
      activePty.resize(cols, rows);
    }
  };

  return { exec, kill, writeStdin, ptyResize };
}
