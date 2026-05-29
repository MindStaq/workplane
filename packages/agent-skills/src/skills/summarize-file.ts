import type { Workplan } from "@workplane/workplans";

export interface SummarizeFileOptions {
  filePath: string;
  provider?: string;
  model?: string;
}

export function summarizeFilePlan(opts: SummarizeFileOptions): Workplan {
  const { filePath, provider = "ollama", model = "llama3" } = opts;

  return {
    id: "summarize-file",
    name: "Summarize File",
    steps: [
      {
        id: "read",
        name: "Read File",
        adapter: "file",
        provider: "file",
        payload: { path: filePath },
        output: { dest: "next" },
      },
      {
        id: "summarize",
        name: "Summarize",
        adapter: provider,
        provider,
        model,
        payload: { prompt: "Summarize the following file content concisely:\n{{prevOutput}}" },
      },
    ],
  };
}
