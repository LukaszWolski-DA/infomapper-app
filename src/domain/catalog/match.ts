// InfoCatalog's matching and ranking (slice 39, S39-03, A3.1, Q8 as answered). Pure, one rule for both adapters.
// - Every word of the query must be found (as a part of a word or more) in the item's name or one of its searched
//   fields; the words may be in different fields. Case and accents are ignored (`fold.ts`).
// - The tiers: 1 the name is the query; 2 an alias or a requirement's key is the query; 3 the name starts with it;
//   4 every word is in the definition; 5 the rest (a rule, a physical name, a classification…).
// - The highlight: each word's matches in a text, as ranges of the original text, merged.

import { foldedWords, foldText, foldWithOrigin } from "./fold";
import type { CatalogItem } from "./items";

export type CatalogTier = 1 | 2 | 3 | 4 | 5;

/** An item with its texts folded once (a search folds only the query). */
export interface IndexedCatalogItem {
  readonly item: CatalogItem;
  readonly name: string;
  readonly alias: readonly string[];
  readonly definition: string;
  /** Everything searched, folded, one string. */
  readonly all: string;
}

export function indexCatalogItem(item: CatalogItem): IndexedCatalogItem {
  const name = foldText(item.name);
  const alias = item.fields.alias.map(foldText);
  const definition = item.fields.definition.map(foldText).join("\n");
  const other = item.fields.other.map(foldText).join("\n");
  return { item, name, alias, definition, all: [name, ...alias, definition, other].join("\n") };
}

/** A query's folded words and its folded whole (the words joined by one space). */
export interface CatalogQuery {
  readonly words: readonly string[];
  readonly whole: string;
}

export function catalogQuery(text: string): CatalogQuery {
  const words = foldedWords(text);
  return { words, whole: words.join(" ") };
}

/** The item's tier for the query, or null when a word is missing. An empty query matches nothing. */
export function matchTier(x: IndexedCatalogItem, q: CatalogQuery): CatalogTier | null {
  if (!q.words.length) return null;
  for (const w of q.words) if (!x.all.includes(w)) return null;
  if (x.name === q.whole) return 1;
  if (x.alias.includes(q.whole)) return 2;
  if (x.name.startsWith(q.whole)) return 3;
  if (q.words.every((w) => x.definition.includes(w))) return 4;
  return 5;
}

export type TextRange = readonly [start: number, end: number];

/** Where the words are found in a text: ranges of the original text (end exclusive), sorted and merged. */
export function highlightRanges(text: string, words: readonly string[]): TextRange[] {
  if (!text || !words.length) return [];
  const { text: folded, start, end } = foldWithOrigin(text);
  const ranges: [number, number][] = [];
  for (const w of words) {
    for (let at = folded.indexOf(w); at >= 0; at = folded.indexOf(w, at + 1)) ranges.push([start[at]!, end[at + w.length - 1]!]);
  }
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged.at(-1);
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

/** A definition cut to one line around its first match (the prototype's rule): its text, whether cut, its ranges. */
export interface DefinitionLine {
  readonly text: string;
  readonly ranges: readonly TextRange[];
}

const LINE_MAX = 180;
const LEAD = 50;
const LATE = 70;

export function definitionLine(definition: string | null, words: readonly string[]): DefinitionLine | null {
  if (!definition) return null;
  const flat = definition.replace(/\s+/gu, " ").trim();
  if (!flat) return null;
  const first = highlightRanges(flat, words)[0];
  const from = first && first[0] > LATE ? first[0] - LEAD : 0;
  const body = flat.slice(from, from + LINE_MAX);
  const text = `${from > 0 ? "…" : ""}${body}${from + LINE_MAX < flat.length ? "…" : ""}`;
  return { text, ranges: highlightRanges(text, words) };
}
