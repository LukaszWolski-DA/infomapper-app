"use client";

// The landing zone's greeting by the browser's hour (slice 39, S39-01: the prototype's `landing()`): "Good morning"
// before 12, "Good afternoon" before 18, "Good evening" after. The server knows no hour of the browser: until the page
// runs, the heading keeps its place, unseen (`useSyncExternalStore`'s server value), so nothing jumps and nothing differs.

import { useSyncExternalStore } from "react";

const noChange = () => () => undefined;

export const greetingOf = (hour: number, firstName: string) => `Good ${hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}, ${firstName}`;

export function Greeting({ firstName }: { firstName: string }) {
  const hour = useSyncExternalStore(noChange, () => new Date().getHours(), () => null);
  return (
    <h1 data-testid="text-greeting" className="m-0 mb-1.5 text-[24px] font-semibold [text-wrap:balance]" style={hour === null ? { visibility: "hidden" } : undefined}>
      {greetingOf(hour ?? 9, firstName)}
    </h1>
  );
}
