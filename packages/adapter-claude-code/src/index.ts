import { createHarnessAdapter } from "@workplane/adapter-harness";

export const claudeCodeAdapter = createHarnessAdapter({
  name: "claude-code",
  kind: "agent.run",
  interactive: true,
  terminalMode: "pty",
  binary: () => process.env.WORKPLANE_CLAUDE_CODE_BIN ?? "claude",
  buildArgs: (payload) => {
    const args = ["-p", payload.prompt, "--output-format", "text"];
    if (payload.model) {
      args.push("--model", payload.model);
    }
    return [...args, ...(payload.extraArgs ?? [])];
  },
  buildInteractiveArgs: (payload) => {
    const args: string[] = [];
    if (payload.model) {
      args.push("--model", payload.model);
    }
    return [...args, ...(payload.extraArgs ?? [])];
  },
});
