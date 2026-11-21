// A figure's content as a Mermaid `erDiagram` block (slice 34, F1, Q4; D-86 as proposed): the entities and source tables
// the figure drew, with their rows as it shows them, and the relationships and source keys between them. Pure text from
// `DocFigure.content`, never a selection of its own (rule 1). Mapping lines, frames, requirement cards and roles have no
// place in an `erDiagram`; the Markdown lists them under the block (`markdown.ts`).
//
// Portable syntax only (Łukasz, 21 November 2026: the file is for exchange, read in any tool that renders Mermaid): what
// Mermaid 9.4.3, 10.9.5 and 12.3.0 all parse (the tests parse every block on the three). So:
// - entity names quoted (spaces, Polish and German letters kept), a `"` written as `'`; no aliases (10.4.0 fails them);
// - an attribute's type and name one word each: letters, digits, `_`, `-` and a type's `(length)`; anything else becomes
//   `_` (a type with a comma keeps its name), the real type or name in the attribute's comment;
// - keys `PK`, `FK`, `PK, FK`; PII, BK and "=" (calculated) in the comment; a relationship always labelled (`""`);
// - no styling, no subgraph, no `%%{init}%%`, no comment at a line's end.

import type { FigureContent, FigureContentRelationship, FigureContentRow } from "@/domain/document/content";

/**
 * The largest block written with attributes, in characters (D4, Łukasz: a threshold sensible for any tool). Mermaid's own
 * `maxTextSize` is 50,000 by default in every version, and the tools that render Mermaid keep the default (VS Code's
 * extensions, Obsidian, GitLab, mermaid.live): above it a diagram is "Maximum text size in diagram exceeded". 40,000 leaves
 * room for a tool that counts the fence or the line ends differently.
 */
export const MERMAID_MAX_CHARS = 40_000;

/** Text inside double quotes: one line, no `"`. */
export const quoted = (text: string): string => `"${text.replace(/"/g, "'").replace(/\s+/g, " ").trim()}"`;

const WORD = /^[A-Za-z][A-Za-z0-9_-]*$/;
const TYPE = /^[A-Za-z][A-Za-z0-9_-]*(\(\d+\))?$/;
/** Words Mermaid reads as keys in an attribute's line. */
const KEY_WORDS = new Set(["PK", "FK", "UK"]);

/** An attribute's name as one word Mermaid accepts, and whether it differs from the real one. */
export function attributeWord(name: string): { word: string; changed: boolean } {
  const trimmed = name.trim();
  if (WORD.test(trimmed) && !KEY_WORDS.has(trimmed.toUpperCase())) return { word: trimmed, changed: false };
  let word = trimmed.replace(/[^A-Za-z0-9_-]/g, "_").replace(/_+/g, "_");
  if (!/^[A-Za-z]/.test(word)) word = `a_${word}`;
  if (KEY_WORDS.has(word.toUpperCase())) word = `${word}_`;
  return { word: word === "a_" ? "a_attribute" : word, changed: true };
}

/** A type as one word Mermaid accepts (`string(100)`, `decimal` for `decimal(18,2)`), and whether it differs. */
export function typeWord(type: string): { word: string; changed: boolean } {
  const trimmed = type.trim().replace(/\s+/g, "");
  if (TYPE.test(trimmed)) return { word: trimmed, changed: trimmed !== type.trim() };
  const lead = /^[A-Za-z][A-Za-z0-9_]*/.exec(trimmed)?.[0];
  return { word: lead ?? "untyped", changed: !!type.trim() };
}

const LEFT = (min: 0 | 1, many: boolean) => (many ? (min ? "}|" : "}o") : min ? "||" : "|o");
const RIGHT = (min: 0 | 1, many: boolean) => (many ? (min ? "|{" : "o{") : min ? "||" : "o|");

/** The crow's foot markers of an end, as Mermaid writes it on the left and on the right (`|o` / `o|`). */
export const mermaidMarkers = (min: 0 | 1, many: boolean): { left: string; right: string } => ({ left: LEFT(min, many), right: RIGHT(min, many) });

/** A relationship's line: the from end's marker on the left, the to end's on the right, its label quoted. */
export const relationshipLine = (from: string, to: string, r: Pick<FigureContentRelationship, "fromMin" | "fromMany" | "toMin" | "toMany" | "label">): string =>
  `${from} ${LEFT(r.fromMin, r.fromMany)}--${RIGHT(r.toMin, r.toMany)} ${to} : ${quoted(r.label ?? "")}`;

function attributeLine(row: FigureContentRow): string {
  const type = typeWord(row.type);
  const name = attributeWord(row.name);
  const keys = [row.pk && "PK", row.fk && "FK"].filter(Boolean).join(", ");
  const comment = [type.changed && row.type.trim(), name.changed && row.name.trim(), row.pii && "PII", row.bk && "BK", row.calc && "="].filter(Boolean).join(" · ");
  return `    ${type.word} ${name.word}${keys ? ` ${keys}` : ""}${comment ? ` ${quoted(comment)}` : ""}`;
}

/**
 * The block's text (without the fence): `erDiagram`, each card once under a unique quoted name (a second card of the
 * same shown name gets " (2)"), its rows unless `attributes` is false, then the relationships and the source keys.
 */
export function erDiagram(content: FigureContent, attributes = true): string {
  const names = new Map<string, string>();
  const used = new Map<string, number>();
  for (const c of content.cards) {
    const base = c.name.replace(/"/g, "'").replace(/\s+/g, " ").trim() || "?";
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    names.set(c.id, quoted(n > 1 ? `${base} (${n})` : base));
  }
  const out = ["erDiagram"];
  for (const c of content.cards) {
    const name = names.get(c.id)!;
    if (!attributes || !c.rows.length) {
      out.push(`  ${name}`);
      continue;
    }
    out.push(`  ${name} {`, ...c.rows.map(attributeLine), "  }");
  }
  for (const r of content.relationships) {
    const from = names.get(r.from), to = names.get(r.to);
    if (from && to) out.push(`  ${relationshipLine(from, to, r)}`);
  }
  // a source key: many rows of the table with the key to one of the referenced table's (the model stores no cardinality)
  for (const k of content.sourceKeys) {
    const from = names.get(k.from), to = names.get(k.to);
    if (!from || !to) continue;
    const label = k.columns.map((p) => `${p.from} → ${p.to}`).join(", ");
    out.push(`  ${relationshipLine(from, to, { fromMin: 0, fromMany: true, toMin: 1, toMany: false, label })}`);
  }
  return out.join("\n");
}

/**
 * The block for a figure under the size limit (D4): with its attributes; above the limit with headers only; above it
 * even then, none (`size` says which).
 */
export function figureDiagram(content: FigureContent): { text: string | null; size: "full" | "headers" | "none" } {
  const full = erDiagram(content);
  if (full.length <= MERMAID_MAX_CHARS) return { text: full, size: "full" };
  const headers = erDiagram(content, false);
  if (headers.length <= MERMAID_MAX_CHARS) return { text: headers, size: "headers" };
  return { text: null, size: "none" };
}
