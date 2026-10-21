import { WorkplanValidationError } from "./errors.js";
import { ConditionError, conditionReferences } from "./expression.js";
import { templateReferences } from "./template.js";
import type { Workplan } from "./types.js";

/** A plan runs as a graph as soon as any step declares a dependency. */
export function isGraphPlan(plan: Workplan): boolean {
  return plan.steps.some((step) => (step.dependsOn?.length ?? 0) > 0);
}

function findCycle(plan: Workplan): string[] | null {
  const deps = new Map(plan.steps.map((step) => [step.id, step.dependsOn ?? []]));
  const state = new Map<string, "visiting" | "done">();
  const path: string[] = [];

  const visit = (id: string): string[] | null => {
    if (state.get(id) === "done" || !deps.has(id)) {
      return null;
    }
    if (state.get(id) === "visiting") {
      return [...path.slice(path.indexOf(id)), id];
    }
    state.set(id, "visiting");
    path.push(id);
    for (const dep of deps.get(id) ?? []) {
      const cycle = visit(dep);
      if (cycle) {
        return cycle;
      }
    }
    path.pop();
    state.set(id, "done");
    return null;
  };

  for (const step of plan.steps) {
    const cycle = visit(step.id);
    if (cycle) {
      return cycle;
    }
  }
  return null;
}

/**
 * Rejects plans the runner cannot execute safely: duplicate or unknown step IDs, dependency cycles,
 * bad conditions, and conditions or templates that read a step which is not guaranteed to have finished.
 */
export function validateWorkplan(plan: Workplan): void {
  const issues: string[] = [];
  const ids = new Set<string>();

  if (!Array.isArray(plan.steps)) {
    throw new WorkplanValidationError(["a workplan needs a steps array"]);
  }
  for (const step of plan.steps) {
    if (!step.id) {
      issues.push(`step "${step.name ?? "?"}" has no id`);
    } else if (ids.has(step.id)) {
      issues.push(`duplicate step id "${step.id}"`);
    }
    ids.add(step.id);
  }
  if (plan.maxParallel !== undefined && (!Number.isInteger(plan.maxParallel) || plan.maxParallel < 1)) {
    issues.push("maxParallel must be a whole number of at least 1");
  }

  for (const step of plan.steps) {
    for (const dep of step.dependsOn ?? []) {
      if (dep === step.id) {
        issues.push(`step "${step.id}" depends on itself`);
      } else if (!ids.has(dep)) {
        issues.push(`step "${step.id}" depends on unknown step "${dep}"`);
      }
    }
    if (step.adapter === "gate") {
      if (step.gate?.onFail !== undefined && !["fail", "approval"].includes(step.gate.onFail)) {
        issues.push(`gate step "${step.id}" has an invalid onFail "${String(step.gate.onFail)}" (use "fail" or "approval")`);
      }
    } else if (step.gate) {
      issues.push(`step "${step.id}" has a gate but its adapter is "${step.adapter}" (gate steps use adapter "gate")`);
    }
  }
  if (issues.length > 0) {
    throw new WorkplanValidationError(issues);
  }

  const cycle = findCycle(plan);
  if (cycle) {
    throw new WorkplanValidationError([`dependency cycle: ${cycle.join(" -> ")}`]);
  }

  const graph = isGraphPlan(plan);
  const byId = new Map(plan.steps.map((step) => [step.id, step]));
  const ancestors = new Map<string, Set<string>>();
  const ancestorsOf = (id: string): Set<string> => {
    const cached = ancestors.get(id);
    if (cached) {
      return cached;
    }
    const result = new Set<string>();
    for (const dep of byId.get(id)?.dependsOn ?? []) {
      result.add(dep);
      for (const transitive of ancestorsOf(dep)) {
        result.add(transitive);
      }
    }
    ancestors.set(id, result);
    return result;
  };

  plan.steps.forEach((step, index) => {
    const finishedBefore = graph ? ancestorsOf(step.id) : new Set(plan.steps.slice(0, index).map((s) => s.id));
    const reads: Array<{ where: string; refs: string[] }> = [];
    for (const [where, expression] of [
      ["when", step.when],
      ["gate.check", step.gate?.check],
    ] as const) {
      if (expression === undefined) {
        continue;
      }
      try {
        reads.push({ where, refs: conditionReferences(expression) });
      } catch (error) {
        issues.push(`step "${step.id}" ${where}: ${error instanceof ConditionError ? error.message : String(error)}`);
      }
    }
    reads.push({ where: "payload", refs: templateReferences(step.payload ?? {}) });
    for (const { where, refs } of reads) {
      for (const ref of refs) {
        if (!ids.has(ref)) {
          issues.push(`step "${step.id}" ${where} reads unknown step "${ref}"`);
        } else if (!finishedBefore.has(ref)) {
          issues.push(
            graph
              ? `step "${step.id}" ${where} reads step "${ref}", which is not one of its dependencies`
              : `step "${step.id}" ${where} reads step "${ref}", which runs after it`,
          );
        }
      }
    }
  });

  if (issues.length > 0) {
    throw new WorkplanValidationError(issues);
  }
}
