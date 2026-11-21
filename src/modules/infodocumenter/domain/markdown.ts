// A document as one Markdown file (slice 34, D-86 as proposed): the same content tree the HTML is drawn from
// (`buildDocument`), written as text for exchange (Łukasz, 21 November 2026: someone renders it in their own tool). A
// pure function beside `ui/document-html.tsx`: no browser, no DOM.
//
// What the renderer decides (the PRD's rules, the acceptance doc's F2 to F17):
// - front matter with the document, workspace, organization, language code, source, the time it was made, the generator
//   and the cover's other fields when set (MT1, D3); the title as the first `#`; a line on Mermaid under it; the
//   contents as links (GitHub's anchors); print-only things left out (MT2): the cover page, page numbers, heading
//   numbers, the watermark, the header and footer, page breaks, the list of figures, the legend, editor hints;
// - headings by depth, never skipping a level (rule 6), whatever levels the tree gives;
// - a long text "under the row" as a column at the table's end (rule 2, D2); a column left empty in every row dropped
//   (rule 4); a line break between values in a cell as ", " and the parts of a line as " · " (rule 3);
// - icons as text (rule 4): a relationship end as Mermaid's markers, a fed and a not-fed dot as "● ○", a colour as
//   nothing; a status as its word, in brackets after other text (rule 9);
// - every model text escaped (F11): Markdown's punctuation where it would become markup, `|` in a table.

import type { DocColumn, DocFigure, DocNode, DocRow, DocRun, DocRuns, FigureContent } from "@/domain/document/content";
import type { DocLanguage } from "@/domain/types";
import type { DocumentTree } from "./document";
import { label, type LabelKey } from "./labels";
import { figureDiagram, mermaidMarkers } from "./mermaid";

export interface MarkdownInput {
  readonly tree: DocumentTree;
  /** The document's name (the Documentation tab's): the front matter's `document`. */
  readonly name: string;
  /** When it is made: ISO 8601 with the browser's offset (`2026-11-21T09:05+01:00`, `localTimestamp`). */
  readonly generated: string;
}

/** A time as ISO 8601 to the minute with its offset from UTC, in the zone the date is read in. */
export function localTimestamp(d: Date): string {
  const p = (n: number) => String(Math.abs(n)).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}${off < 0 ? "-" : "+"}${p(Math.trunc(off / 60))}:${p(off % 60)}`;
}

const TRANSLITERATE: Readonly<Record<string, string>> = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z", ä: "a", ö: "o", ü: "u", ß: "ss" };

/**
 * The file's name from the document's name (F9): lower case, Polish and German letters as plain ones, every other run of
 * characters one hyphen; `document.md` when nothing is left.
 */
export function markdownFileName(name: string): string {
  const plain = name
    .toLowerCase()
    .replace(/[ąćęłńóśźżäöüß]/g, (c) => TRANSLITERATE[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
  const slug = plain.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "document"}.md`;
}

// ---- escaping (F11) ----

/** Model text as Markdown text: what would become markup escaped, the rest left readable (`cust_id` stays). */
export function escapeText(s: string): string {
  let out = "";
  const chars = [...s];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    const prev = chars[i - 1] ?? "";
    const next = chars[i + 1] ?? "";
    if ("\\`*[]~$|".includes(c)) out += `\\${c}`;
    // an underscore inside a word never starts emphasis; at a word's edge it may
    else if (c === "_" && !(/[\p{L}\p{N}]/u.test(prev) && /[\p{L}\p{N}]/u.test(next))) out += "\\_";
    else if (c === "<" && /[A-Za-z/!?]/.test(next)) out += "\\<";
    else if (c === "&" && /^#?[A-Za-z0-9]+;/.test(chars.slice(i + 1, i + 12).join(""))) out += "\\&";
    else out += c;
  }
  return out;
}

/** A line's start that would open a block (a heading, a quote, a list item, a rule) escaped. */
function escapeLineStart(line: string): string {
  const m = /^(\s*)(.*)$/s.exec(line)!;
  const [, lead, rest] = m as unknown as [string, string, string];
  if (/^[#>+=-]/.test(rest)) return `${lead}\\${rest}`;
  const num = /^(\d+)([.)])/.exec(rest);
  if (num) return `${lead}${num[1]}\\${rest.slice(num[1]!.length)}`;
  return line;
}

/** A code span around a text: a fence longer than any run of backticks in it. */
export function codeSpan(s: string, inTable = false): string {
  const text = s.replace(/\s*\n\s*/g, " ");
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = "`".repeat(longest + 1);
  const pad = text.startsWith("`") || text.endsWith("`") || (text.startsWith(" ") && text.endsWith(" ") && text.trim()) ? " " : "";
  const body = inTable ? text.replace(/\|/g, "\\|") : text;
  return `${fence}${pad}${body}${pad}${fence}`;
}

// ---- runs ----

type Where = "cell" | "para" | "heading";

/** What a run that is drawn as a mark says in text (F4); null: it says nothing. */
function markText(r: DocRun, where: Where = "para"): string | null {
  if (r.end) {
    const m = mermaidMarkers(r.end.min, r.end.many);
    return `${codeSpan(m.left, where === "cell")} / ${codeSpan(m.right, where === "cell")}`;
  }
  return r.dots ? "● ○" : null;
}

const isMark = (r: DocRun) => !!(r.end || r.line || r.swatch || r.dots);

/** Whether a run writes anything. */
const says = (r: DocRun) => (isMark(r) ? markText(r) !== null : !!r.text.trim());

/**
 * Runs as inline Markdown. A pill (a status) is its word alone in its cell, else in brackets after the text (rule 9); a
 * line break between values is ", " in a cell, a hard break in a paragraph (rule 3); `mono` and a code chip are code.
 */
export function inline(runs: DocRuns, where: Where): string {
  const others = runs.filter((r) => !r.pill && says(r));
  let out = "";
  const sep = (s: string) => {
    if (out && !/[\s(]$/.test(out)) out += s;
  };
  let open: { code: boolean; strong: boolean; text: string } | null = null;
  const flush = () => {
    if (!open) return;
    const { code, strong, text } = open;
    open = null;
    if (!text) return;
    let body = code ? codeSpan(text, where === "cell") : escapeText(text.replace(/\s*\n\s*/g, where === "para" ? "\n" : " ").replace(/[ \t]{2,}/g, " "));
    if (where === "para") body = body.replace(/\n/g, "\\\n");
    // two runs that both bring a space give one
    if (!out || /[ \t]$/.test(out)) body = body.replace(/^[ \t]+/, "");
    if (!strong) {
      out += body;
      return;
    }
    // `** x**` is no emphasis: the spaces go outside
    const lead = /^\s*/.exec(body)![0], tail = /\s*$/.exec(body)![0], core = body.trim();
    out += core ? `${lead}**${core}**${tail}` : body;
  };
  const push = (text: string, code: boolean, strong: boolean) => {
    if (open && open.code === code && open.strong === strong) open.text += text;
    else {
      flush();
      open = { code, strong, text };
    }
  };
  const raw = (text: string) => {
    flush();
    out += text;
  };
  for (const r of runs) {
    if (r.lineBreak && (out || open)) {
      flush();
      if (where === "para") out += "\\\n";
      else if (out.trim()) out = `${out.replace(/[\s,·]+$/, "")}, `;
    }
    if (isMark(r)) {
      const t = markText(r, where);
      if (t !== null) raw(t);
      continue;
    }
    if (r.pill) {
      const word = r.text.trim();
      if (!word) continue;
      if (others.length) {
        flush();
        sep(" ");
        raw(`(${escapeText(word)})`);
      } else raw(escapeText(word));
      continue;
    }
    if (r.chip === "plain") {
      push(r.text, true, !!r.strong);
      continue;
    }
    push(r.text, !!r.mono && !r.chip, !!r.strong);
  }
  flush();
  return out.replace(/[ \t]+$/g, "");
}

/** The plain text of runs (a heading's anchor), marks left out. */
const plainText = (runs: DocRuns) => runs.filter((r) => !isMark(r) && !r.pill).map((r) => r.text).join("").replace(/\s+/g, " ").trim();

// ---- words ----

interface Words {
  readonly language: DocLanguage;
  readonly t: (key: LabelKey, values?: Readonly<Record<string, string | number>>) => string;
}

// ---- blocks ----

interface Ctx {
  readonly words: Words;
  /** Every heading's plain text in document order (for the anchors). */
  readonly headings: string[];
  /** The tree's levels open above the current node, each with its Markdown depth. */
  stack: { level: number; depth: number }[];
}

/** A heading at the tree's `level` (5 for a requirement block's title) one below the nearest higher one (rule 6). */
function heading(ctx: Ctx, level: number, text: string, raw?: string): string {
  while (ctx.stack.length && ctx.stack[ctx.stack.length - 1]!.level >= level) ctx.stack.pop();
  const depth = Math.min(6, (ctx.stack[ctx.stack.length - 1]?.depth ?? 2) + 1);
  ctx.stack.push({ level, depth });
  ctx.headings.push(raw ?? text);
  return `${"#".repeat(depth)} ${raw === undefined ? escapeText(text) : text}`;
}

/** A paragraph's text with each line's start escaped (its lines are hard breaks of one paragraph). */
const paragraph = (text: string) => text.split("\n").map(escapeLineStart).join("\n");

function table(node: Extract<DocNode, { kind: "table" }>, ctx: Ctx): string[] {
  const w = ctx.words;
  const long = node.long ?? [];
  const columns: DocColumn[] = [...node.columns, ...long];
  const rowCells = (r: DocRow): DocRuns[] => [...(r.alignedCells ?? r.cells), ...long.map((_, i) => r.longCells?.[i] ?? [])];
  const body = node.rows.map((r) => rowCells(r).map((c) => inline(c, "cell")));
  // a column with nothing in any row says nothing (rule 4): left out
  const keep = columns.map((_, i) => !node.rows.length || body.some((cells) => (cells[i] ?? "").trim()));
  const cols = columns.filter((_, i) => keep[i]);
  if (!cols.length) return [];
  const header = cols.map((c) => escapeText(c.label.trim() || w.t("mark")));
  const lines = [`| ${header.join(" | ")} |`, `|${cols.map(() => " --- ").join("|")}|`];
  for (const cells of body) lines.push(`|${cells.filter((_, i) => keep[i]).map((c) => (c.trim() ? ` ${c.trim()} ` : " ")).join("|")}|`);
  const out = [lines.join("\n")];
  // a long text under a row the table does not name as a column (none known today): a list after it, nothing lost
  if (!long.length) {
    const below = node.rows.flatMap((r) => (r.below ?? []).map((b) => inline(b, "para")).filter(Boolean));
    if (below.length) out.push(below.map((b) => `- ${escapeLineStart(b)}`).join("\n"));
  }
  return out;
}

function list(node: Extract<DocNode, { kind: "list" }>): string[] {
  const items = node.items.map((item, i) => {
    let runs = item.runs;
    // the overview's concepts: the concept, then its entities (two spaces apart in the tree): "Customer: a, b" (rule 3)
    if (node.plain) {
      const at = runs.findIndex((r, j) => j > 0 && !isMark(r) && !r.text.trim() && runs.slice(0, j).some(says));
      if (at > 0) runs = [...runs.slice(0, at), { text: ": " }, ...runs.slice(at + 1)];
    }
    const lead = item.label ? `${inline(item.label, "cell")} ` : "";
    const text = `${lead}${inline(runs, "para")}`.replace(/\\\n/g, "\\\n   ");
    return `${node.ordered ? `${i + 1}.` : "-"} ${escapeLineStart(text)}`;
  });
  return items.length ? [items.join("\n")] : [];
}

function cards(node: Extract<DocNode, { kind: "cards" }>, ctx: Ctx): string[] {
  if (node.variant === "requirement") {
    const out: string[] = [];
    for (const c of node.cards) {
      const title = inline(c.title, "heading").replace(/\s+/g, " ").trim();
      out.push(heading(ctx, 5, title, title));
      ctx.headings[ctx.headings.length - 1] = plainText(c.title);
      const props = c.props.map((p) => inline(p, "cell")).filter((x) => x.trim());
      if (props.length) out.push(paragraph(props.join(" · ")));
      for (const l of c.lines) {
        const runs = inline(l.runs, "para");
        if (runs.trim()) out.push(paragraph(`${l.label ? `${escapeText(l.label)} ` : ""}${runs}`));
      }
      if (c.text) {
        const text = inline(c.text, "para");
        if (text.trim()) out.push(paragraph(text));
      }
    }
    return out;
  }
  // one block per attribute: a list item, its properties after its name, its text and labelled lines under it
  const items = node.cards.map((c) => {
    const head = [`**${inline(c.title, "cell")}**`, ...c.props.map((p) => inline(p, "cell")).filter((x) => x.trim())].join(" · ");
    const more = [...(c.text ? [inline(c.text, "para")] : []), ...c.lines.map((l) => `${escapeText(l.label)}: ${inline(l.runs, "cell")}`)].filter((x) => x.trim());
    return [`- ${head}`, ...more.map((m) => `  ${escapeLineStart(m).replace(/\\\n/g, "\\\n  ")}`)].join("\\\n");
  });
  return items.length ? [items.join("\n")] : [];
}

function nodes(list: readonly DocNode[], ctx: Ctx): string[] {
  return list.flatMap((n) => node(n, ctx));
}

function node(n: DocNode, ctx: Ctx): string[] {
  const w = ctx.words;
  switch (n.kind) {
    case "heading":
      return [heading(ctx, n.level, n.text)];
    case "paragraph": {
      if (n.placeholder) return [];
      const text = inline(n.runs, "para");
      return text.trim() ? [paragraph(text)] : [];
    }
    case "meta": {
      const parts = n.parts.map((p) => inline(p, "cell")).filter((x) => x.trim());
      return parts.length ? [paragraph(parts.join(" · "))] : [];
    }
    case "table":
      return table(n, ctx);
    case "list":
      return list(n);
    case "cards":
      return cards(n, ctx);
    case "group":
      return nodes(n.nodes, ctx);
    case "figure":
      return figure(n.figure, w);
    case "note":
      return [`> ${escapeText(n.text)}`];
    case "legend":
    case "pageBreak":
      return [];
  }
}

// ---- figures (rule 1, F1, F16, D4) ----

const nameCode = (s: string) => codeSpan(s);

/** A figure: its Mermaid block, what an `erDiagram` cannot show as lists under it, its caption in italics. */
export function figure(f: DocFigure, w: Words): string[] {
  const out: string[] = [];
  const c = f.content;
  if (c) {
    const d = figureDiagram(c);
    if (d.text) out.push(`\`\`\`mermaid\n${d.text}\n\`\`\``);
    if (d.size === "headers") out.push(escapeText(w.t("md_tooLarge")));
    if (d.size === "none") out.push(escapeText(w.t("md_tooLargeAll")), ...section(w.t("md_entities"), c.cards.map((x) => escapeText(x.name))));
    out.push(...figureLists(c, w));
  }
  out.push(`*${escapeText(`${f.word} ${f.number || ""}`.trim())}. ${escapeText(f.caption)}*`);
  return out;
}

const section = (title: string, items: readonly string[]): string[] => (items.length ? [`**${escapeText(title)}**`, items.map((x) => `- ${escapeLineStart(x)}`).join("\n")] : []);

function figureLists(c: FigureContent, w: Words): string[] {
  const t = w.t;
  const status = (s: "draft" | "review" | "approved" | null) => (s && s !== "approved" ? ` (${escapeText(t(s))})` : "");
  const byId = new Map(c.cards.map((x) => [x.id, x.name]));
  const kind = (k: "concept" | "source_system" | "free") => t(k === "concept" ? "figConcept" : k === "source_system" ? "figSource" : "figFree");
  const roles = c.cards.filter((x) => x.role).map((x) => `**${escapeText(x.name)}**: ${escapeText(x.role!)}`);
  const frames = c.frames.map((f) => {
    const members = f.members.map((id) => escapeText(byId.get(id) ?? "?")).join(", ");
    return `**${escapeText(f.name)}** (${escapeText(kind(f.kind))}${f.collapsed ? `, ${escapeText(t("figCollapsed"))}` : ""})${members ? `: ${members}` : ""}`;
  });
  const mappings = c.mappings.map(
    (m) =>
      `${m.inputs.map(nameCode).join(" + ")} → ${nameCode(m.target)}${status(m.status)}` +
      (m.transform ? ` · ƒ${m.rule ? `: ${escapeText(m.rule)}` : ""}` : "") +
      (m.warn ? ` · ${escapeText(t("md_typeProblem"))}` : ""),
  );
  const cube = c.moduleLines.map((l) => `${l.inputs.map(nameCode).join(" + ")} → ${nameCode(l.target)}${status(l.status)}${l.chip ? ` · ${escapeText(l.chip)}` : ""}`);
  const reqs = c.requirements.map((r) => `${escapeText(r.key)} ${escapeText(r.name)}${r.traces.length ? ` → ${r.traces.map(escapeText).join(", ")}` : ""}`);
  return [...section(t("md_roles"), roles), ...section(t("md_frames"), frames), ...section(t("md_mappings"), mappings), ...section(t("md_cube"), cube), ...section(t("md_reqs"), reqs)];
}

// ---- the document ----

/** GitHub's anchor of a heading: lower case, letters, digits, spaces as hyphens; a repeat gets "-1", "-2" (F12). */
function anchors(texts: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return texts.map((text) => {
    const base = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .trim()
      .replace(/\s/g, "-");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  });
}

const yaml = (s: string) => JSON.stringify(s);

/** The whole document as Markdown (MT1 to MT4, the nine rules). */
export function documentMarkdown({ tree, name, generated }: MarkdownInput): string {
  const t = (key: LabelKey, values?: Readonly<Record<string, string | number>>) => label(tree.language, key, values);
  const words: Words = { language: tree.language, t };
  const row = (key: string) => {
    const value = tree.cover.rows.find((r) => r.key === key)?.value ?? "";
    return value && value !== "–" ? value : "";
  };

  // the front matter (MT1, rule 7, D3): every value a double-quoted string
  const front: [string, string][] = [
    ["document", name],
    ...(tree.cover.title !== name ? [["title", tree.cover.title] as [string, string]] : []),
    ["workspace", row("workspace")],
    ["organization", tree.cover.organization],
    ["language", tree.language],
    ["source", "live model"],
    ["generated", generated],
    ["generator", "InfoMapper (InfoDocumenter)"],
    ...(tree.cover.subtitle ? [["subtitle", tree.cover.subtitle] as [string, string]] : []),
    ...(["client", "version", "status"] as const).flatMap((k) => (row(k) ? [[k, row(k)] as [string, string]] : [])),
    ...(row("preparedBy") ? [["prepared_by", row("preparedBy")] as [string, string]] : []),
  ];

  // the sections first, for their headings' anchors
  const headings: string[] = [];
  const sectionAt: number[] = [];
  const bodies = tree.sections.map((s) => {
    const ctx: Ctx = { words, headings, stack: [] };
    sectionAt.push(headings.length);
    headings.push(s.heading);
    return [`## ${escapeText(s.heading)}`, ...nodes(s.nodes, ctx)];
  });
  const contents = tree.style.contents && tree.sections.length;
  const all = anchors([tree.cover.title, ...(contents ? [tree.contents.heading] : []), ...headings]);
  const offset = 1 + (contents ? 1 : 0);

  const blocks: string[] = [
    ["---", ...front.map(([k, v]) => `${k}: ${yaml(v)}`), "---"].join("\n"),
    `# ${escapeText(tree.cover.title)}`,
    escapeText(t("md_note")),
  ];
  if (contents) {
    blocks.push(`## ${escapeText(tree.contents.heading)}`);
    blocks.push(tree.sections.map((s, i) => `- [${escapeText(s.heading)}](#${all[offset + sectionAt[i]!]})`).join("\n"));
  }
  if (tree.skipped.length) blocks.push(tree.skipped.map((s) => `> ${escapeText(s.text)}`).join("\n>\n"));
  for (const b of bodies) blocks.push(...b);
  return `${blocks.filter((b) => b.trim()).join("\n\n")}\n`;
}
