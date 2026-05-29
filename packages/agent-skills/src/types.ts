import type { Workplan, WorkplanRunContext } from "@workplane/workplans";

export interface ResolvedInputs<TInput> {
  raw: TInput;
}

export interface SkillContext {
  inputs: Record<string, unknown>;
  ctx: WorkplanRunContext;
}

export interface AIOutput<TOutput> {
  result: TOutput;
  metadata?: Record<string, unknown>;
}

export interface OutputRef {
  type: string;
  id: string;
  [key: string]: unknown;
}

export interface CanonicalSkillWorkflow<TInput = unknown, TOutput = unknown> {
  resolveInputs(raw: TInput): Promise<ResolvedInputs<TInput>>;
  buildContext(inputs: ResolvedInputs<TInput>): Promise<SkillContext>;
  invokeAI(context: SkillContext): Promise<AIOutput<TOutput>>;
  persistOutput(output: AIOutput<TOutput>): Promise<OutputRef>;
  notify?(ref: OutputRef): Promise<void>;
}

export interface SkillRunResult<TOutput> {
  output: TOutput;
  ref: OutputRef;
  metadata?: Record<string, unknown>;
}

export interface SkillEntry {
  name: string;
  description: string;
  buildPlan(options: Record<string, unknown>): Workplan;
}
