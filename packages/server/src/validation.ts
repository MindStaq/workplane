import { z } from "zod";
import type { AppendInputEventInput, CreateTaskInput } from "../../types/src/index.js";

const repoFields = {
  repo: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
};

const shellTaskSchema = z.object({
  kind: z.literal("shell.exec"),
  adapter: z.literal("shell"),
  requires: z.array(z.string().min(1)).optional(),
  payload: z.object({
    command: z.string().min(1),
    args: z.array(z.string()).optional(),
    cwd: z.string().min(1).optional(),
    ...repoFields,
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
    testCommand: z.string().min(1).optional(),
  }),
});

const ollamaTaskSchema = z.object({
  kind: z.literal("inference.batch"),
  adapter: z.literal("ollama"),
  requires: z.array(z.string().min(1)).optional(),
  payload: z.object({
    model: z.string().min(1),
    prompt: z.string().min(1),
    inputFile: z.string().min(1).optional(),
  }),
});

const harnessPayloadSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().min(1).optional(),
  repo: z.string().min(1),
  branch: z.string().min(1).optional(),
  testCommand: z.string().min(1).optional(),
  extraArgs: z.array(z.string()).optional(),
  interactive: z.boolean().optional(),
});

const codexTaskSchema = z.object({
  kind: z.literal("agent.run"),
  adapter: z.literal("codex"),
  requires: z.array(z.string().min(1)).optional(),
  payload: harnessPayloadSchema,
});

const claudeCodeTaskSchema = z.object({
  kind: z.literal("agent.run"),
  adapter: z.literal("claude-code"),
  requires: z.array(z.string().min(1)).optional(),
  payload: harnessPayloadSchema,
});

const taskSchema = z.discriminatedUnion("adapter", [
  shellTaskSchema,
  aiderTaskSchema,
  ollamaTaskSchema,
  codexTaskSchema,
  claudeCodeTaskSchema,
]);

export function validateCreateTaskInput(input: unknown): CreateTaskInput {
  return taskSchema.parse(input);
}

const inputEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("stdin"),
    payload: z.object({ data: z.string() }),
  }),
  z.object({
    kind: z.literal("signal"),
    payload: z.object({ signal: z.enum(["SIGTERM", "SIGKILL", "SIGINT"]) }),
  }),
  z.object({
    kind: z.literal("resize"),
    payload: z.object({
      rows: z.number().int().positive(),
      cols: z.number().int().positive(),
    }),
  }),
]);

export function validateInputEvent(input: unknown): AppendInputEventInput {
  return inputEventSchema.parse(input);
}
