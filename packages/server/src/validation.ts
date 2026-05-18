import { z } from "zod";
import type { CreateTaskInput } from "../../types/src/index.js";

const shellTaskSchema = z.object({
  kind: z.literal("shell.exec"),
  adapter: z.literal("shell"),
  requires: z.array(z.string().min(1)).optional(),
  payload: z.object({
    command: z.string().min(1),
    args: z.array(z.string()).optional(),
    cwd: z.string().min(1).optional(),
    repo: z.string().min(1).optional(),
    branch: z.string().min(1).optional(),
  }),
});

const aiderTaskSchema = z.object({
  kind: z.literal("agent.run"),
  adapter: z.literal("aider"),
  requires: z.array(z.string().min(1)).optional(),
  payload: z.object({
    prompt: z.string().min(1),
    model: z.string().min(1).optional(),
    repo: z.string().min(1),
    branch: z.string().min(1).optional(),
  }),
});

const taskSchema = z.discriminatedUnion("adapter", [shellTaskSchema, aiderTaskSchema]);

export function validateCreateTaskInput(input: unknown): CreateTaskInput {
  return taskSchema.parse(input);
}

