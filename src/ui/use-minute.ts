"use client";

// The browser's minute in a client component (slice 36; slice 35's rule, D-87): "" until the browser's time zone is
// known (the server's HTML, hydration), never a time in the server's zone. The pure rules are `local-time.ts`.

import { useSyncExternalStore } from "react";
import { minuteText } from "./local-time";

const noStore = () => () => undefined;
/** Whether the browser's time zone is known: false on the server and during hydration, true after it. */
export const useLocalTime = (): boolean => useSyncExternalStore(noStore, () => true, () => false);

/** The browser's minute, or "" until it is known. */
export function useMinute(): (iso: string) => string {
  const local = useLocalTime();
  return (iso) => (local ? minuteText(iso) : "");
}
