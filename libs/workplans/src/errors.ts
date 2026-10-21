export class WorkplanValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`invalid workplan: ${issues.join("; ")}`);
    this.name = "WorkplanValidationError";
  }
}

/** Thrown by a NodeHandle when a dispatched step fails, so the step result still links to its task and run. */
export class StepExecutionError extends Error {
  constructor(
    message: string,
    readonly links: { taskId?: string; runId?: string; exitCode?: number; output?: string } = {},
  ) {
    super(message);
    this.name = "StepExecutionError";
  }
}
