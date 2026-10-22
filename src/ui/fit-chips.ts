// How many of the view-state bar's chips stay in the row (slice 6a, Łukasz's step 1 answer 3): the rest fold into
// “+{n}”. Chips fold from the end as soon as they do not fit; one comes back only with `hysteresis` pixels to spare, so a
// chip at the edge cannot flip between the row and “+{n}” on every observation.

export interface ChipFit {
  /** Each chip's width, in order. */
  widths: readonly number[];
  /** The gap between two chips. */
  gap: number;
  /** The “+{n}” chip's width. */
  plus: number;
  /** The room the chips and “+{n}” have. */
  room: number;
  /** How many are shown now. */
  shown: number;
  hysteresis: number;
}

export function fitChips({ widths, gap, plus, room, shown, hysteresis }: ChipFit): number {
  const need = (k: number) => {
    let w = 0;
    for (let i = 0; i < k; i++) w += widths[i]! + (i ? gap : 0);
    return k < widths.length ? w + (k ? gap : 0) + plus : w;
  };
  let k = Math.min(shown, widths.length);
  while (k > 0 && need(k) > room) k--;
  while (k < widths.length && need(k + 1) <= room - hysteresis) k++;
  return k;
}
