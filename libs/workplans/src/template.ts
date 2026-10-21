import type { StepView } from "./expression.js";

const STEP_TOKEN = /\{\{\s*steps\.([\w-]+)\.(output|exitCode|status)\s*\}\}/g;

/**
 * Replaces `{{prevOutput}}` and `{{steps.<id>.output|exitCode|status}}` in top-level string values.
 * Pass `prevOutput` as undefined to leave `{{prevOutput}}` tokens untouched.
 */
export function applyTemplate(
  payload: Record<string, unknown>,
  prevOutput: string | undefined,
  steps: Record<string, StepView> = {},
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).map(([k, v]) => {
      if (typeof v !== "string") {
        return [k, v];
      }
      let value = prevOutput === undefined ? v : v.replaceAll("{{prevOutput}}", prevOutput);
      value = value.replace(STEP_TOKEN, (token, stepId: string, field: keyof StepView) =>
        steps[stepId] ? String(steps[stepId][field]) : token,
      );
      return [k, value];
    }),
  );
}

/** Step IDs referenced by `{{steps.<id>...}}` tokens in a payload's string values. */
export function templateReferences(payload: Record<string, unknown>): string[] {
  const refs = new Set<string>();
  for (const value of Object.values(payload)) {
    if (typeof value === "string") {
      for (const match of value.matchAll(STEP_TOKEN)) {
        refs.add(match[1]);
      }
    }
  }
  return [...refs];
}
