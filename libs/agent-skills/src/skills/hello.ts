import type { Workplan } from "@workplane/workplans";

export interface HelloOptions {
  message?: string;
}

export function helloPlan(opts: HelloOptions = {}): Workplan {
  const message = opts.message ?? "hello from workplane";
  return {
    id: "hello",
    name: "Hello",
    description: "Single shell echo — useful for scheduler smoke tests",
    steps: [
      {
        id: "echo",
        name: "Echo",
        adapter: "shell",
        provider: "shell",
        payload: { command: `echo ${JSON.stringify(message)}` },
      },
    ],
  };
}
