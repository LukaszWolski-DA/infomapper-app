// What the canvas fades: the capability slice 4b uses (slice 4p, PRD section 6). A store of its own outside React state,
// so switching it re-renders only what draws the fading (`FadeLayer`) and never the canvas itself
// (`window.__imCanvasCommits` stays as it is, S4P-12). Switched by the measuring hook (`TestHooks.tsx`) and by Focus
// (slice 4b-1, step 7: `focusOn` below, turned into a request for the selection by `FocusDriver`).

import { useSyncExternalStore } from "react";
import type { Uuid } from "@/domain/ids";
import type { Lit, LitTarget } from "@/domain/model/lit";
import { createValueStore } from "./value-store";

/**
 * What Focus is on (slice 4b-1, PRD item 21): the selection, as the domain's targets (an entity, a table, an attribute,
 * a column, a mapping, a relationship, or several entities and tables for a frame or a multi-selection) or a
 * requirement.
 */
export type FocusTarget = LitTarget | { t: "requirement"; id: Uuid };

/**
 * What to light; the canvas fades the rest (cards and notes under a veil at about the prototype's 25 %, lines under it):
 *   { focus: entityId }       Focus on an entity (the short form; slice 4p's hook)
 *   { focus: FocusTarget }    Focus on a selection; the canvas works out what it lights (domain `targetLit`, and
 *                             `requirementFocusLit` on the requirement index for a requirement)
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
 * A short key for the request: `focus:<entity id>` (as in slice 4p), `focus:<kind>:<id>` (e.g. `focus:requirement:<id>`),
 * `focus:several:<entity ids>|<table ids>`, `lit:<key>`, or "" for none.
 */
export const fadeKey = (r: FadeRequest): string => {
  if (!r) return "";
  if ("lit" in r) return `lit:${r.key}`;
  const t = focusTarget(r.focus);
  if (t.t === "several") return `focus:several:${t.entities.join(",")}|${t.tables.join(",")}`;
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

/**
 * Focus (slice 4b-1, PRD items 20–22; D-22): on or off. Momentary, never saved: off again after a reload and when
 * switching canvas. While on, the canvas fades everything not connected to the selection (`FocusDriver`); a change of
 * selection moves the lit set. A store of its own, so switching it never re-renders the canvas (S4B1-13).
 */
export const focusOn = createValueStore(false);
