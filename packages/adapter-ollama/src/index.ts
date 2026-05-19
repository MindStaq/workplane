import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WorkAdapter } from "../../adapter-sdk/src/index.js";

export interface OllamaPayload {
  model: string;
  prompt: string;
  inputFile?: string;
}

export const ollamaAdapter: WorkAdapter<OllamaPayload> = {
  name: "ollama",
  kind: "inference.batch",
  async run(context, payload) {
    const args = ["run", payload.model, payload.prompt];
    const result = await context.exec("ollama", args, { cwd: context.workspacePath });
    if (result.exitCode !== 0) {
      throw new Error(`ollama failed with exit code ${result.exitCode}`);
    }

    const artifactsPath = await context.ensureWorkspace("artifacts");
    const outputPath = join(artifactsPath, "inference-output.txt");
    const output = `${result.stdout}${result.stderr}`.trim();
    await writeFile(outputPath, output, "utf8");
    await context.emitArtifact({
      type: "inference.output",
      name: "inference-output.txt",
      path: outputPath,
      metadata: { model: payload.model, adapter: "ollama" },
    });

    if (payload.inputFile) {
      await context.log("system", `inputFile ${payload.inputFile} noted (batch file expansion not implemented)`, "inference");
    }
  },
};
