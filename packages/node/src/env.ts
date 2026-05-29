export function pickNodeEnv(allowlist: string[] | undefined): Record<string, string> {
  if (!allowlist || allowlist.length === 0) {
    return { ...process.env } as Record<string, string>;
  }
  const picked: Record<string, string> = {};
  for (const key of allowlist) {
    const value = process.env[key];
    if (value !== undefined) {
      picked[key] = value;
    }
  }
  picked.PATH = process.env.PATH ?? "";
  picked.HOME = process.env.HOME ?? "";
  return picked;
}
