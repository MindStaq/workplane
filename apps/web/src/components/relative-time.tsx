import { duration, relativeTime } from "../lib/format";

/**
 * Renders a time relative to now. The server and the browser render a few seconds apart, so the text can
 * differ by a tick between SSR and hydration; suppressHydrationWarning accepts that on purpose.
 */
export function RelativeTime({ iso }: { iso: string | null }) {
  return (
    <time dateTime={iso ?? undefined} title={iso ?? undefined} suppressHydrationWarning>
      {relativeTime(iso)}
    </time>
  );
}

export function Elapsed({ start, end }: { start: string | null; end: string | null }) {
  return <span suppressHydrationWarning>{duration(start, end)}</span>;
}
