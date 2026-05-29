import OpenAI from "openai";

export interface OpenAIStepOptions {
  model: string;
  prompt: string;
  apiKey?: string;
}

export async function runOpenAIStep(opts: OpenAIStepOptions): Promise<string> {
  const client = new OpenAI({ apiKey: opts.apiKey ?? process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: opts.model,
    messages: [{ role: "user", content: opts.prompt }],
  });
  return completion.choices[0]?.message.content ?? "";
}
