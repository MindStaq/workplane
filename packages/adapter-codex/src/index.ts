import { createHarnessAdapter } from "../../adapter-harness/src/index.js";

export const codexAdapter = createHarnessAdapter({
  name: "codex",
  kind: "agent.run",
  interactive: true,
  terminalMode: "stdio",
  binary: () => process.env.WORKPLANE_CODEX_BIN ?? "codex",
  buildArgs: (payload) => {
    const args = [...(payload.extraArgs ?? ["--approval-mode", "full-auto"])];
    if (payload.model) {
      args.push("--model", payload.model);
    }
    args.push(payload.prompt);
    return args;
  },
  buildInteractiveArgs: (payload) => {
    const args: string[] = [...(payload.extraArgs ?? [])];
    if (payload.model) {
      args.push("--model", payload.model);
    }
    return args;
  },
});
