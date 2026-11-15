// A canvas's look (D-12, D-22) and, since slice 16 (item 3, D-71), its relationship lines hidden by kind. One rule in
// one place for the command, the page's look and the view-state bar: a hidden kind is a key stored as true, and a kind
// shown has no key, so a look stored before slice 16 (or the column's SQL default) reads as both shown.

import type { CanvasLook, PageOutline } from "../types";

/** The two kinds: relationships between entities (logical and dimensional), and between source tables (D-62). */
export const HIDDEN_RELATIONSHIP_KEYS = ["hideEntityRelationships", "hideSourceRelationships"] as const;
export type HiddenRelationshipKey = (typeof HIDDEN_RELATIONSHIP_KEYS)[number];

/**
 * A change of the look: background, grid, layer, a kind hidden (true) or shown (false), and since slice 27 (step 4,
 * Q6) the page outline: its paper, orientation and size, or null for off.
 */
export type CanvasLookPatch = Partial<Pick<CanvasLook, "background" | "grid" | "layer">> & Partial<Record<HiddenRelationshipKey, boolean>> & { pageOutline?: PageOutline | null };

/** The look after a patch; a kind shown loses its key, and so does the page outline turned off. */
export function applyLookPatch(look: CanvasLook, patch: CanvasLookPatch): CanvasLook {
  const next: CanvasLook = { background: patch.background ?? look.background, grid: patch.grid ?? look.grid, layer: patch.layer ?? look.layer };
  for (const key of HIDDEN_RELATIONSHIP_KEYS) if (patch[key] ?? look[key] === true) next[key] = true;
  const outline = patch.pageOutline === undefined ? look.pageOutline : patch.pageOutline;
  if (outline) next.pageOutline = { paper: outline.paper, orientation: outline.orientation, pt: outline.pt };
  return next;
}

/** Whether two page outlines are the same (both off, or the same paper, orientation and size). */
export const sameOutline = (a: PageOutline | undefined, b: PageOutline | undefined): boolean =>
  a === b || (!!a && !!b && a.paper === b.paper && a.orientation === b.orientation && a.pt === b.pt);

/** Whether a kind of relationship lines is hidden on the canvas. */
export const isHidden = (look: Pick<CanvasLook, HiddenRelationshipKey>, key: HiddenRelationshipKey): boolean => look[key] === true;

export const sameLook = (a: CanvasLook, b: CanvasLook): boolean =>
  a.background === b.background && a.grid === b.grid && a.layer === b.layer && HIDDEN_RELATIONSHIP_KEYS.every((k) => isHidden(a, k) === isHidden(b, k)) && sameOutline(a.pageOutline, b.pageOutline);
