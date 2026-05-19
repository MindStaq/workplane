import { createHarnessAdapter } from "../../adapter-harness/src/index.js";

export const codexAdapter = createHarnessAdapter({
  name: "codex",
  kind: "agent.run",
  binary: () => process.env.WORKPLANE_CODEX_BIN ?? "codex",
  defaultArgs: ["--approval-mode", "full-auto"],
  buildArgs: (payload) => {
    const args = [...(payload.extraArgs ?? ["--approval-mode", "full-auto"])];
    if (payload.model) {
      args.push("--model", payload.model);
    }
    args.push(payload.prompt);
    return args;
  },
});
