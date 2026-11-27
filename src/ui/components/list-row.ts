// Slice 38 (S38-05, the prototype's `.li .n:has(+.m.mono)`): a list row with a name on the left and physical names on
// the right (an attribute and the source columns that feed it). The name stays whole up to 65 % of the row; the physical
// names take the rest and shorten with an ellipsis, their full text in their title (the caller's). Rows with a short
// detail on the right keep `Li`'s own shape.

/** The name: its own width, at most 65 % of the row, then cut. */
export const ROW_NAME_WINS = "min-w-0 max-w-[65%] flex-[0_1_auto] truncate"
/** The physical names: the rest of the row, right-aligned, cut with an ellipsis. */
export const ROW_PHYSICAL = "min-w-0 flex-[1_1_0] truncate whitespace-nowrap pl-2 text-right text-[11.5px] text-im-ink-3"
