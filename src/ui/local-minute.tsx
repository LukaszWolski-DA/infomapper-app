"use client";

// A time drawn in the browser's time zone (slice 35's rule, D-87; slice 36's B5.1 a): "yyyy-mm-dd hh:mm" once the page
// runs in the browser; until then (the server's HTML, hydration) nothing visible in its place, an invisible placeholder
// of the same width, never a time in another zone.

import { minuteText } from "./local-time";
import { useLocalTime } from "./use-minute";

// as wide as any time (tabular figures), so nothing moves when the time replaces it
const TIME_PLACEHOLDER = "0000-00-00 00:00";

export function LocalMinute({ iso, testId }: { iso: string; testId?: string }) {
  const local = useLocalTime();
  return local ? (
    <span className="tabular-nums" data-testid={testId}>
      {minuteText(iso)}
    </span>
  ) : (
    <span className="invisible tabular-nums" aria-hidden="true" data-testid={testId ? `${testId}-pending` : undefined}>
      {TIME_PLACEHOLDER}
    </span>
  );
}
