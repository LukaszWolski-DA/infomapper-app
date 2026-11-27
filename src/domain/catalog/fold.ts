// Text folded for searching (slice 39, Q8): case and accents ignored, so "zrodlo" finds "źródło" and "strasse" finds
// "Straße". Pure; one rule for the text searched and the words typed. NFD decomposes neither ł nor ß, so a few letters
// are folded by hand.

/** Letters NFD does not decompose, folded by hand (after lower case). */
const BY_HAND: Readonly<Record<string, string>> = { ł: "l", ß: "ss", ø: "o", đ: "d", æ: "ae", œ: "oe", ı: "i", ς: "σ" };
const MARKS = /\p{M}/gu;

/** One code point folded: lower case, its marks dropped, a hand-folded letter replaced. */
function foldChar(c: string): string {
  const lower = c.toLowerCase().normalize("NFD").replace(MARKS, "");
  let out = "";
  for (const x of lower) out += BY_HAND[x] ?? x;
  return out;
}

/**
 * The text folded, and for each folded character the original text's range it came from (`start`, `end` exclusive). A
 * character that folds to nothing (a combining mark) joins the range of the character before it.
 */
export interface FoldedText {
  readonly text: string;
  readonly start: readonly number[];
  readonly end: readonly number[];
}

export function foldWithOrigin(text: string): FoldedText {
  let out = "";
  const start: number[] = [];
  const end: number[] = [];
  let i = 0;
  for (const c of text) {
    const f = foldChar(c);
    const after = i + c.length;
    if (!f.length) {
      // a mark: the previous character's range takes it in
      for (let k = end.length - 1; k >= 0 && end[k] === i; k--) end[k] = after;
    }
    for (let k = 0; k < f.length; k++) {
      start.push(i);
      end.push(after);
    }
    out += f;
    i = after;
  }
  return { text: out, start, end };
}

const HAND = /[łßøđæœıς]/gu;

/**
 * The text folded for comparison: the same as `foldWithOrigin(text).text`, on the whole string at once (the index folds
 * every item's texts, so this is the fast path; the highlight alone needs the ranges).
 */
export const foldText = (text: string): string => text.toLowerCase().normalize("NFD").replace(MARKS, "").replace(HAND, (c) => BY_HAND[c]!);

/** The words of a query, folded: split on white space, empty ones dropped. */
export const foldedWords = (query: string): string[] => foldText(query).split(/\s+/u).filter(Boolean);
