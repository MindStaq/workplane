/** Pure formatting helpers. They read the real clock, so call them from components, never at module load. */

export function relativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const future = diff > 0;
  const fmt = (value: number, unit: string) => (future ? `in ${value}${unit}` : `${value}${unit} ago`);
  if (abs < 60_000) return future ? "in <1m" : "just now";
  if (abs < 3_600_000) return fmt(Math.round(abs / 60_000), "m");
  if (abs < 86_400_000) return fmt(Math.round(abs / 3_600_000), "h");
  return fmt(Math.round(abs / 86_400_000), "d");
}

export function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${rem}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** Elapsed time between two instants; an open-ended run is measured up to `now`. */
export function duration(startIso: string | null, endIso: string | null, now: number = Date.now()): string {
  if (!startIso) return "—";
  const end = endIso ? new Date(endIso).getTime() : now;
  return formatMs(Math.max(0, end - new Date(startIso).getTime()));
}

export function clockTime(iso: string): string {
  return new Date(iso).toISOString().slice(11, 19);
}

const KNOWN_CRON: Record<string, string> = {
  "0 2 * * *": "Every day at 02:00",
  "0 9 * * 1": "Mondays at 09:00",
  "*/5 * * * *": "Every 5 minutes",
  "*/15 * * * *": "Every 15 minutes",
  "0 * * * *": "Every hour",
};

export function describeCron(expression: string): string {
  return KNOWN_CRON[expression] ?? "Custom schedule";
}
