// What the canvas fades (slice 4p, PRD items 3 and 6): Focus on an entity, the lens of a requirement, or nothing. A
// store of its own outside React state, so switching it re-renders only what draws the fading and never the canvas
// itself (`window.__imCanvasCommits` stays as it is, S4P-12). In this slice it is switched only by the measuring hook
// (`TestHooks.tsx`); slice 4b switches it from Focus and the requirement panel.

import { useSyncExternalStore } from "react";

export type FadeRequest = { focus: string } | { lens: string } | null;

let current: FadeRequest = null;
const listeners = new Set<() => void>();

/** A short key for the request (`focus:<id>`, `lens:<id>`, or "" for none). */
export const fadeKey = (r: FadeRequest): string => (!r ? "" : "focus" in r ? `focus:${r.focus}` : `lens:${r.lens}`);

export function requestFade(next: FadeRequest): void {
  if (fadeKey(next) === fadeKey(current)) return;
  current = next;
  for (const l of listeners) l();
}

/** Calls `l` after every change; returns the unsubscribe. */
export const subscribeFade = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const currentFade = (): FadeRequest => current;

/** The fading asked for now. */
export const useFadeRequest = (): FadeRequest => useSyncExternalStore(subscribeFade, currentFade, () => null);
