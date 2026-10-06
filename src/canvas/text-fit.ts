// Which names on a card need clipping (S1A-14). An `overflow: hidden` element is a clip in Chrome's paint tree, and
// clips on every row made Chrome re-layerize the canvas layer at about 25 ms per frame while panning (the spike's
// cards had none). So only text that may not fit gets the clip and the ellipsis; the rest is drawn without one.
// The estimate errs on the side of clipping: a wide glyph counts wide, and the other parts of the row count in full.

import { CARD_W, CARD_W_MAX, CARD_W_MIN } from "./geometry";

/** Width estimate of IBM Plex Sans at `px`, per character, rounded up (wide letters, capitals and digits count more). */
function sansWidth(text: string, px: number): number {
  let em = 0;
  for (const ch of text) {
    if ("mwMW@".includes(ch)) em += 0.86;
    else if (/[A-Z0-9]/.test(ch)) em += 0.68;
    else if ("ijlI.,:;'|!".includes(ch)) em += 0.32;
    else em += 0.58;
  }
  return em * px;
}

/** IBM Plex Mono is 0.6 em per character. */
const monoWidth = (text: string, px: number) => text.length * 0.6 * px;

const ROW_PAD = 22; // .row: 12 px left, 10 px right
const GAP = 6;
const TAG = 26; // a PII or BK badge
const SAFETY = 6;

export interface RowText {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  pii: boolean;
  bk: boolean;
  mappings: number;
}

/** Whether a row's name may not fit beside its key, badges, type and mapped dot (prototype .row layout). */
export function rowNeedsClip(row: RowText, kind: "ent" | "src", dualKeys: boolean, width: number = CARD_W): boolean {
  const key = dualKeys ? 34 : 18;
  const tags = (row.pii ? TAG + GAP : 0) + (row.bk ? TAG + GAP : 0);
  const type = kind === "src" ? monoWidth(row.type, 10.5) : sansWidth(row.type, 11);
  const dot = row.mappings > 1 ? 16 + 2 * 4 + String(row.mappings).length * 6 : 10;
  const available = width - ROW_PAD - key - GAP - tags - GAP - type - GAP - dot - SAFETY;
  const name = kind === "src" ? monoWidth(row.name, 12) : sansWidth(row.name, 12.5);
  return name > available;
}

/** Whether a card's title may not fit beside the coverage bar and its count (prototype .c-l2). */
export function titleNeedsClip(name: string, kind: "ent" | "src", coverage: string, width: number = CARD_W): boolean {
  const available = width - 14 - 8 - 8 - 42 - 8 - sansWidth(coverage, 11) - SAFETY;
  return (kind === "src" ? monoWidth(name, 13.5) : sansWidth(name, 14) * 1.05) > available;
}

/** Whether a card's first line (stereotype and concept, or the source path) may not fit beside the card tools. */
export function lineNeedsClip(parts: string[], kind: "ent" | "src", width: number = CARD_W): boolean {
  // filter button with its longest label, collapse button, and on entities the relate button (slice 1b)
  const tools = 64 + 20 + 1 + (kind === "ent" ? 21 : 0);
  const text = kind === "src" ? monoWidth(parts.join(""), 11) : parts.reduce((w, p) => w + sansWidth(p, 11), 0) + 6 * (parts.length - 1);
  return text > width - 14 - 8 - 6 - tools - SAFETY;
}

/**
 * “Fit width to names” (D-37, prototype fitWidths): the narrowest width, in steps of 8 between 200 and 600 px, at which
 * no row name and not the title needs clipping. null when that is the default width (nothing to store).
 */
export function fitWidth(card: { kind: "ent" | "src"; name: string; coverage: string; rows: readonly RowText[] }): number | null {
  const dual = card.rows.some((r) => r.pk && r.fk);
  for (let w = CARD_W_MIN; w <= CARD_W_MAX; w += 8) {
    if (titleNeedsClip(card.name, card.kind, card.coverage, w)) continue;
    if (card.rows.some((r) => rowNeedsClip(r, card.kind, dual, w))) continue;
    return w === CARD_W ? null : w;
  }
  return CARD_W_MAX;
}
