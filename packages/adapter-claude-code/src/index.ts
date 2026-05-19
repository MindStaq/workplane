import { createHarnessAdapter } from "../../adapter-harness/src/index.js";

export const claudeCodeAdapter = createHarnessAdapter({
  name: "claude-code",
  kind: "agent.run",
  binary: () => process.env.WORKPLANE_CLAUDE_CODE_BIN ?? "claude",
  buildArgs: (payload) => {
    const args = ["-p", payload.prompt, "--output-format", "text"];
    if (payload.model) {
      args.push("--model", payload.model);
    }
    const extra = payload.extraArgs ?? [];
    return [...args, ...extra];
  },
});
