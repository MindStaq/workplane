import Anthropic from "@anthropic-ai/sdk";

export interface AnthropicStepOptions {
  model: string;
  prompt: string;
  apiKey?: string;
}

export async function runAnthropicStep(opts: AnthropicStepOptions): Promise<string> {
  const client = new Anthropic({ apiKey: opts.apiKey ?? process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: opts.model,
    max_tokens: 4096,
    messages: [{ role: "user", content: opts.prompt }],
  });
  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}
