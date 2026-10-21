import type { Workplan } from "@workplane/workplans";

export interface HelloOptions {
  message?: string;
  /** Run the echo as a shell task on a fleet node instead of inline. */
  fleet?: boolean;
}

export function helloPlan(opts: HelloOptions = {}): Workplan {
  const message = opts.message ?? "hello from workplane";
  const command = `echo ${JSON.stringify(message)}`;
  return {
    id: "hello",
    name: "Hello",
    description: "Single shell echo — useful for scheduler smoke tests",
    steps: [
      opts.fleet
        ? { id: "echo", name: "Echo", adapter: "shell", requires: ["shell"], payload: { command } }
        : { id: "echo", name: "Echo", adapter: "shell", provider: "shell", payload: { command } },
    ],
  };
}
