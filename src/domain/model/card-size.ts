// A card's height from data (AD-24 rule 2; prototype H, R, PAD and estH): one rule for the canvas, the large demo data
// and the domain, which places cards itself when it opens a live canvas (slice 3b). Never measured from the DOM.

import type { RowFilter } from "../types";
import { CARD_HEADER_HEIGHT } from "./frames";

/** Row height and body padding (prototype R, PAD); the header height is `CARD_HEADER_HEIGHT` (D-05). */
export const CARD_ROW_HEIGHT = 26;
export const CARD_BODY_PAD = 6;

/** What a row filter needs to know about a row. `relevant`: it carries the live canvas's label, or one of its mappings does. */
export interface FilterableRow {
  mappings: number;
  pk: boolean;
  fk: boolean;
  bk: boolean;
  relevant?: boolean;
}

/** Whether a row shows under a row filter (prototype rowsOf; `labeled`: the relevant rows of a live canvas, slice 3b). */
export function rowShown(row: FilterableRow, filter: RowFilter): boolean {
  switch (filter) {
    case "mapped":
      return row.mappings > 0;
    case "unmapped":
      return row.mappings === 0;
    case "keys":
      return row.pk || row.fk || row.bk;
    case "labeled":
      return !!row.relevant;
    default:
      return true;
  }
}

/** Height of a card showing this many rows: the header only when collapsed, else header, padding and at least one line. */
export function cardHeightFor(shownRows: number, collapsed = false): number {
  if (collapsed) return CARD_HEADER_HEIGHT;
  return CARD_HEADER_HEIGHT + CARD_BODY_PAD * 2 + Math.max(1, shownRows) * CARD_ROW_HEIGHT;
}

/** Height of a card with these rows under its filter. */
export function cardHeightOf(card: { rows: readonly FilterableRow[]; collapsed: boolean; rowFilter: RowFilter }): number {
  if (card.collapsed) return CARD_HEADER_HEIGHT;
  let shown = 0;
  for (const r of card.rows) if (rowShown(r, card.rowFilter)) shown++;
  return cardHeightFor(shown);
}
