import { Ollama } from "ollama";

export interface OllamaStepOptions {
  model: string;
  prompt: string;
  host?: string;
}

export async function runOllamaStep(opts: OllamaStepOptions): Promise<string> {
  const host = opts.host ?? process.env.OLLAMA_HOST ?? "http://localhost:11434";
  const client = new Ollama({ host });
  const response = await client.generate({ model: opts.model, prompt: opts.prompt });
  return response.response;
}
