// What the canvas fades: the capability slice 4b uses (slice 4p, PRD section 6). A store of its own outside React state,
// so switching it re-renders only what draws the fading (`FadeLayer`) and never the canvas itself
// (`window.__imCanvasCommits` stays as it is, S4P-12). Switched by the measuring hook (`TestHooks.tsx`) and, from slice
// 4b-1's step 7, by Focus.

import { useSyncExternalStore } from "react";
import type { Uuid } from "@/domain/ids";
import type { Lit } from "@/domain/model/lit";

/**
 * What Focus is on (slice 4b-1; PRD item 21). Step 3 has an entity and a requirement; step 7 adds the other selections
 * (table, frame, attribute, column, mapping, relationship, several).
 */
export type FocusTarget = { t: "entity"; id: Uuid } | { t: "requirement"; id: Uuid };

/**
 * What to light; the canvas fades the rest (cards and notes under a veil at about the prototype's 25 %, lines under it):
 *   { focus: entityId }       Focus on an entity (the short form; slice 4p's hook)
 *   { focus: FocusTarget }    Focus on an entity or a requirement; the canvas works out what it lights (domain
 *                             `focusLit`, `requirementFocusLit` on the requirement index)
 *   { lit, key }              a lit set worked out elsewhere: entities and tables (their cards), rows with a covered or
 *                             gap colour, mappings and relationships (their lines); `key` names it, and a new set needs
 *                             a new key
 *   null                      no fading
 * Slice 4b-1 removed the lens (`{ lens }`): selecting a requirement colours its scope, and fading is always Focus.
 */
export type FadeRequest = { focus: Uuid | FocusTarget } | { lit: Lit; key: string } | null;

/** The target of a Focus request, the short form read as an entity. */
export const focusTarget = (focus: Uuid | FocusTarget): FocusTarget => (typeof focus === "string" ? { t: "entity", id: focus } : focus);

/**
 * A short key for the request: `focus:<entity id>` (as in slice 4p), `focus:requirement:<id>`, `lit:<key>`, or "" for
 * none.
 */
export const fadeKey = (r: FadeRequest): string => {
  if (!r) return "";
  if ("lit" in r) return `lit:${r.key}`;
  const t = focusTarget(r.focus);
  return t.t === "entity" ? `focus:${t.id}` : `focus:${t.t}:${t.id}`;
};

let current: FadeRequest = null;
const listeners = new Set<() => void>();

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
