export function applyTemplate(payload: Record<string, unknown>, prevOutput: string): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).map(([k, v]) => [
      k,
      typeof v === "string" ? v.replaceAll("{{prevOutput}}", prevOutput) : v,
    ]),
  );
}
