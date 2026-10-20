// Dragging a requirement from the left panel onto the canvas (slice 4b-2, PRD items 17–19; prototype dropReq): what
// lies under the pointer decides what a drop does. An attribute or column row links the requirement to it, an entity or
// table card (not on a row) to the element, a mapping line to the mapping; empty canvas, a collapsed frame's block or
// anything else places the requirement's card there (or moves it, when it is here already: answer M). The hit test reads
// the element under the pointer once per `dragover`; the rest is pure, so it is tested without a browser.

import type { Uuid } from "@/domain/ids";
import type { LabelTarget } from "@/domain/model/labels";
import type { RequirementLink } from "@/domain/types";

/** What a drop at the pointer would do. */
export type DropTarget =
  | { t: "row"; cardId: Uuid; rowId: Uuid; target: LabelTarget; name: string; linked: boolean }
  | { t: "card"; cardId: Uuid; target: LabelTarget; name: string; linked: boolean }
  | { t: "map"; mappingId: Uuid; target: LabelTarget; name: string; linked: boolean }
  | { t: "place"; move: boolean };

/** The same target (the store is written only when it changes, so a drag over one target re-renders nothing). */
export const sameDropTarget = (a: DropTarget | null, b: DropTarget | null): boolean =>
  a === b ||
  (!!a &&
    !!b &&
    a.t === b.t &&
    (a.t === "place" ? a.move === (b as typeof a).move : a.target.id === (b as typeof a).target.id && a.linked === (b as typeof a).linked));

/** The column of a requirement link that names this kind of element. */
const COLUMN: Record<LabelTarget["kind"], keyof Pick<RequirementLink, "entity_id" | "attribute_id" | "mapping_id" | "source_table_id" | "source_column_id">> = {
  entity: "entity_id",
  attribute: "attribute_id",
  mapping: "mapping_id",
  source_table: "source_table_id",
  source_column: "source_column_id",
};

/** Whether a requirement is linked directly to the element (its live links). */
export const isLinkedTo = (links: readonly RequirementLink[], target: LabelTarget): boolean =>
  links.some((k) => k.deleted_at === null && k[COLUMN[target.kind]] === target.id);

/** The hint at the pointer (item 18). */
export function dropHint(d: DropTarget): string {
  if (d.t === "place") return d.move ? "Move card" : "Place card";
  return d.linked ? `Already linked to ${d.name}` : `Link to ${d.name}`;
}

/** The toasts after a drop (item 19). */
export const DROP_TOAST = {
  linked: (key: string, name: string) => `Linked ${key} to ${name}.`,
  already: (key: string, name: string) => `${key} is already linked to ${name}.`,
  placed: (key: string) => `Placed ${key} on this canvas. Dashed lines show what it traces to.`,
  moved: (key: string) => `Moved ${key}'s card.`,
} as const;

/** What the hit test needs from the canvas: the cards' data, a mapping's name, and the requirement's links. */
export interface DropLookup {
  /** An entity or table card by its id: its kind, element, name and its rows' names. */
  card: (cardId: Uuid) => { kind: "ent" | "src"; targetId: Uuid; name: string; rowName: (rowId: Uuid) => string | undefined } | null;
  mappingName: (mappingId: Uuid) => string | null;
  links: readonly RequirementLink[];
  /** The requirement's card is on this canvas (a place moves it). */
  hasCard: boolean;
}

/**
 * What lies under the pointer for a requirement's drop: a row of an entity or table card at 40 % and above (rows are
 * drawn only there), else a mapping line (its hit path), else an entity or table card, else a place. A block, a note
 * or a requirement card under the pointer is a place.
 */
export function dropTargetAt(el: Element | null, o: DropLookup): DropTarget {
  const place: DropTarget = { t: "place", move: o.hasCard };
  if (!el) return place;
  const cardEl = el.closest<HTMLElement>(".card.ent[data-card], .card.src[data-card]");
  const rowEl = cardEl ? el.closest<HTMLElement>(".row[data-row]") : null;
  if (cardEl && rowEl && cardEl.contains(rowEl)) {
    const card = o.card(cardEl.dataset.card!);
    const rowId = rowEl.dataset.row!;
    const rowName = card?.rowName(rowId);
    if (card && rowName !== undefined) {
      const target: LabelTarget = { kind: card.kind === "ent" ? "attribute" : "source_column", id: rowId };
      return { t: "row", cardId: cardEl.dataset.card!, rowId, target, name: rowName, linked: isLinkedTo(o.links, target) };
    }
  }
  const mappingId = cardEl ? undefined : el.closest<SVGElement>("[data-mapping]")?.dataset.mapping;
  if (mappingId) {
    const name = o.mappingName(mappingId);
    if (name) {
      const target: LabelTarget = { kind: "mapping", id: mappingId };
      return { t: "map", mappingId, target, name, linked: isLinkedTo(o.links, target) };
    }
  }
  if (cardEl) {
    const card = o.card(cardEl.dataset.card!);
    if (card) {
      const target: LabelTarget = { kind: card.kind === "ent" ? "entity" : "source_table", id: card.targetId };
      return { t: "card", cardId: cardEl.dataset.card!, target, name: card.name, linked: isLinkedTo(o.links, target) };
    }
  }
  return place;
}

/**
 * The requirement being dragged from the left panel, set on its `dragstart` and cleared on `dragend`: a `dragover` sees
 * only the drag's types, not its data, and the hint needs to know whether the requirement is linked already.
 */
export const requirementDrag: { current: { requirementId: Uuid; key: string } | null } = { current: null };
