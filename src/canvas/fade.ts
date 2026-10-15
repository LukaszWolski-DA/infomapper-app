// What the canvas fades: the capability slice 4b uses (slice 4p, PRD section 6). A store of its own outside React state,
// so switching it re-renders only what draws the fading (`FadeLayer`) and never the canvas itself
// (`window.__imCanvasCommits` stays as it is, S4P-12). In this slice it is switched only by the measuring hook
// (`TestHooks.tsx`); slice 4b switches it from Focus and the requirement panel.

import { useSyncExternalStore } from "react";
import type { Lit } from "@/domain/model/lit";

/**
 * What to light; the canvas fades the rest (cards and notes to about 25 %, lines under the veil):
 *   { focus: entityId }       Focus on an entity; the canvas works out what it lights (domain `focusLit`)
 *   { lens: requirementId }   a requirement's lens (domain `lensLit` on the requirement index), rows coloured
 *   { lit, key }              a lit set worked out elsewhere: entities and tables (their cards), rows with a covered or
 *                             gap colour, mappings and relationships (their lines); `key` names it, and a new set needs
 *                             a new key
 *   null                      no fading
 */
export type FadeRequest = { focus: string } | { lens: string } | { lit: Lit; key: string } | null;

let current: FadeRequest = null;
const listeners = new Set<() => void>();

/** A short key for the request (`focus:<id>`, `lens:<id>`, `lit:<key>`, or "" for none). */
export const fadeKey = (r: FadeRequest): string => (!r ? "" : "focus" in r ? `focus:${r.focus}` : "lens" in r ? `lens:${r.lens}` : `lit:${r.key}`);

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
