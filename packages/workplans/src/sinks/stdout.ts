export function printStepResult(stepName: string, output: string): void {
  process.stdout.write(`=== step: ${stepName} ===\n${output}\n\n`);
}
