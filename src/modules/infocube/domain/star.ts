// A fact's star diagram (slice 27, step 3, Q5; the prototype's `starFigure`): the fact in the middle with all its rows,
// its dimensions in scope around it, placed as cards in memory and drawn by InfoMapper's figure builder as a canvas of
// its own (`SectionBuildInput.figures.placed`), so InfoDocumenter draws it without knowing InfoCube (AD-33). Pure.
//
// The prototype's rule: up to 6 dimensions stand left and right of the fact, in turn; more go above and below too (left,
// right, top, bottom in turn). The fact card is 260 px wide, each dimension 220 px; the columns stand 100 px from the
// fact, their cards 30 px apart, centred on the fact's middle; the rows above and below 70 px from it, 40 px apart,
// centred on the fact's middle. The cards' heights are the canvas's (`cardHeightFor` from their rows under the filter,
// F11), not an estimate.

import type { PlacedCard } from "@/domain/document/sections";
import type { Uuid } from "@/domain/ids";
import { cardHeightFor, rowShown } from "@/domain/model/card-size";
import type { Attribute, RowFilter } from "@/domain/types";

export const STAR_FACT_WIDTH = 260;
export const STAR_DIMENSION_WIDTH = 220;
const GAP_X = 100;
const GAP_Y = 70;
const GAP_V = 30;
const GAP_H = 40;
/** "Dimensions drawn per star, at most" (D5). */
export const STAR_MAX = [6, 8, 12, 16, 24] as const;
/** "Dimension cards in the star": "Keys only", "All attributes". */
export const STAR_ROWS = ["keys", "all"] as const;
export type StarRows = (typeof STAR_ROWS)[number];

export interface StarLayout {
  readonly cards: readonly PlacedCard[];
  /** The dimensions drawn, and all of them (the caption's note beyond the limit). */
  readonly shown: number;
  readonly all: number;
}

/**
 * The star's cards: the fact at 0,0 with all its rows, the first `max` of its dimensions (in the order given, each once)
 * around it with their keys or all their attributes; null without a dimension.
 */
export function starLayout(factId: Uuid, dimensionIds: readonly Uuid[], attributesOf: (entityId: Uuid) => readonly Attribute[], rows: StarRows, max: number): StarLayout | null {
  const all = [...new Set(dimensionIds)];
  if (!all.length) return null;
  const dims = all.slice(0, max);
  const filter: RowFilter = rows === "keys" ? "keys" : "all";
  const heightOf = (id: Uuid, f: RowFilter) => {
    const shown = attributesOf(id).filter((a) => rowShown({ mappings: 0, pk: a.is_primary_key, fk: a.is_foreign_key, bk: a.is_business_key }, f)).length;
    return cardHeightFor(shown);
  };
  const factH = heightOf(factId, "all");
  const cards: PlacedCard[] = [{ entityId: factId, x: 0, y: 0, width: STAR_FACT_WIDTH, rowFilter: "all" }];
  const side: Record<"L" | "R" | "T" | "B", Uuid[]> = { L: [], R: [], T: [], B: [] };
  const order = dims.length <= 6 ? (["L", "R"] as const) : (["L", "R", "T", "B"] as const);
  dims.forEach((id, i) => side[order[i % order.length]!].push(id));
  const column = (list: readonly Uuid[], x: number) => {
    const hs = list.map((id) => heightOf(id, filter));
    let y = factH / 2 - (hs.reduce((a, b) => a + b, 0) + (list.length - 1) * GAP_V) / 2;
    list.forEach((id, i) => {
      cards.push({ entityId: id, x, y, width: STAR_DIMENSION_WIDTH, rowFilter: filter });
      y += hs[i]! + GAP_V;
    });
  };
  const row = (list: readonly Uuid[], top: boolean) => {
    if (!list.length) return;
    let x = STAR_FACT_WIDTH / 2 - (list.length * STAR_DIMENSION_WIDTH + (list.length - 1) * GAP_H) / 2;
    const tallest = Math.max(...list.map((id) => heightOf(id, filter)));
    for (const id of list) {
      cards.push({ entityId: id, x, y: top ? -GAP_Y - tallest : factH + GAP_Y, width: STAR_DIMENSION_WIDTH, rowFilter: filter });
      x += STAR_DIMENSION_WIDTH + GAP_H;
    }
  };
  column(side.L, -STAR_DIMENSION_WIDTH - GAP_X);
  column(side.R, STAR_FACT_WIDTH + GAP_X);
  row(side.T, true);
  row(side.B, false);
  return { cards, shown: dims.length, all: all.length };
}
