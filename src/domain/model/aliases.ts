// Aliases of entities and attributes on a canvas (slice 11, D-64): what a card shows, from the canvas's mode and the
// card's exception in two dimensions, entity names and attribute names. The name stays primary: outside the canvas,
// and in toasts and questions about a card, the name is shown (P3, Łukasz's answer Q-B).

import type { Canvas, CanvasItem, NameMode } from "../types";

/** The two dimensions a canvas and a card show names or aliases in (P4). */
export const NAME_DIMENSIONS = ["entity", "attribute"] as const;
export type NameDimension = (typeof NAME_DIMENSIONS)[number];

/** The column of a dimension, the same on `canvas` and `canvas_item`. */
export const NAMES_COLUMN = { entity: "entity_names", attribute: "attribute_names" } as const satisfies Record<NameDimension, keyof Canvas & keyof CanvasItem>;

/** The canvas's mode in a dimension: null reads as name. */
export const canvasMode = (canvas: Pick<Canvas, "entity_names" | "attribute_names">, dimension: NameDimension): NameMode =>
  canvas[NAMES_COLUMN[dimension]] ?? "name";

/** A card's mode in a dimension: its exception, or its canvas's mode when it has none. */
export const cardMode = (
  item: Pick<CanvasItem, "entity_names" | "attribute_names">,
  canvas: Pick<Canvas, "entity_names" | "attribute_names">,
  dimension: NameDimension,
): NameMode => item[NAMES_COLUMN[dimension]] ?? canvasMode(canvas, dimension);

/** The exception to store for a card's choice: none when the choice equals the canvas's mode (item 3). */
export const exceptionFor = (choice: NameMode | null, canvas: Pick<Canvas, "entity_names" | "attribute_names">, dimension: NameDimension): NameMode | null =>
  choice === null || choice === canvasMode(canvas, dimension) ? null : choice;

/**
 * The canvas's control in a dimension (item 8): its mode, or `mixed` when a live card of the canvas has an exception
 * there (as a "select all" check box). From the data only, never from the page.
 */
export function namesControl(
  canvas: Pick<Canvas, "id" | "entity_names" | "attribute_names">,
  items: readonly Pick<CanvasItem, "canvas_id" | "deleted_at" | "entity_names" | "attribute_names">[],
  dimension: NameDimension,
): NameMode | "mixed" {
  const column = NAMES_COLUMN[dimension];
  return items.some((i) => i.canvas_id === canvas.id && i.deleted_at === null && i[column] !== null) ? "mixed" : canvasMode(canvas, dimension);
}

/** What a header or a row shows (item 10): the alias in alias mode when there is one, otherwise the name (P7). */
export const shownName = (named: { name: string; alias: string | null }, mode: NameMode): string =>
  mode === "alias" && named.alias ? named.alias : named.name;

/**
 * The texts an entity card shows: its header by the card's entity mode, its rows by its attribute mode, row by row with
 * the name as fallback. `attributes` in the card's order; the result keeps it.
 */
export function cardShownNames(
  item: Pick<CanvasItem, "entity_names" | "attribute_names">,
  canvas: Pick<Canvas, "entity_names" | "attribute_names">,
  entity: { name: string; alias: string | null },
  attributes: readonly { name: string; alias: string | null }[],
): { header: string; rows: string[] } {
  const rowMode = cardMode(item, canvas, "attribute");
  return { header: shownName(entity, cardMode(item, canvas, "entity")), rows: attributes.map((a) => shownName(a, rowMode)) };
}
