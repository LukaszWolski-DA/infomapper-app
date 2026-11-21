// Slice 34 (S34-02, S34-03, Q7): a document as Markdown, checked rule by rule over the text, on the demo's three
// documents, a document of every section type in every layout and long-text mode, in English, Polish and German, with
// frames and names Mermaid must keep. Every Mermaid block parses on Mermaid 9.4.3, 10.9.5 and 12.3.0 (Łukasz,
// 21 November 2026: the file is for exchange, read in any tool; only syntax old and new versions both parse).

import { describe, expect, it } from "vitest";
import { DOCUMENT_SECTION_TYPES, DOCUMENT_TABLES, documentStateFor } from "@/compose/documents";
import { buildSeed } from "@/data/local/seed";
import { addLargeWorkspace, LARGE_IDS } from "@/data/local/seed-large";
import type { DocFigure, DocNode, FigureContent } from "@/domain/document/content";
import { newFigure } from "@/domain/document/figure-entry";
import { workspaceSnapshotOf, type StoredRows } from "@/domain/model/workspace-model";
import type { ModuleTable } from "@/domain/types";
import { buildDocument } from "@/modules/infodocumenter/domain/document";
import type { DocumentTree } from "@/modules/infodocumenter/domain/document";
import { label, type LabelKey } from "@/modules/infodocumenter/domain/labels";
import { codeSpan, documentMarkdown, escapeText, localTimestamp, markdownFileName } from "@/modules/infodocumenter/domain/markdown";
import { attributeWord, erDiagram, figureDiagram, MERMAID_MAX_CHARS, typeWord } from "@/modules/infodocumenter/domain/mermaid";
import { demoDb, demoDocuments, documentOf, everySection, framedDb, GENERATED, stageOneDocument, treeOf } from "./lib/markdown-documents";

// ---- the documents ----

interface Case {
  readonly name: string;
  readonly tree: DocumentTree;
  readonly md: string;
}

const demo = demoDb();
const framed = framedDb();
const cases: Case[] = [];
const add = (name: string, definition: Parameters<typeof treeOf>[0], db = demo) => {
  const tree = treeOf(definition, db);
  cases.push({ name, tree, md: documentMarkdown({ tree, name: definition.name, generated: GENERATED }) });
};
for (const d of demoDocuments(demo)) add(`demo: ${d.name}`, d);
for (const layout of ["below", "column", "cards"] as const) for (const longTexts of ["row", "after", "column"] as const) add(`every section, ${layout}, ${longTexts}`, everySection(demo, { layout, longTexts }));
for (const language of ["pl", "de"] as const) add(`every section in ${language}`, everySection(demo, { language }));
add("every section, requirements as a table, traceability as a matrix", everySection(demo, { requirements: "table", trace: "matrix" }));
add("every section with frames and Polish names", everySection(framed), framed);
add("every section with frames in Polish", everySection(framed, { language: "pl" }), framed);
add("the sample's stage 1 documentation", stageOneDocument(demo));
const caseNamed = (name: string) => cases.find((c) => c.name === name)!;

// ---- reading the text ----

/** The lines outside fenced code blocks. */
const prose = (md: string) => {
  const out: string[] = [];
  let fenced = false;
  for (const line of md.split("\n")) {
    if (line.startsWith("```")) fenced = !fenced;
    else if (!fenced) out.push(line);
  }
  return out;
};
const blocks = (md: string) => [...md.matchAll(/```mermaid\n([\s\S]*?)\n```/g)].map((m) => m[1]!);
/** A table row's cells: split on `|` that is not escaped. */
const cellsOf = (line: string) => line.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim());
const tablesOf = (md: string) => {
  const lines = prose(md);
  const out: string[][][] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]!.startsWith("|") || !lines[i + 1]?.startsWith("| ---")) continue;
    const rows = [cellsOf(lines[i]!), cellsOf(lines[i + 1]!)];
    let j = i + 2;
    for (; j < lines.length && lines[j]!.startsWith("|"); j++) rows.push(cellsOf(lines[j]!));
    out.push(rows);
    i = j;
  }
  return out;
};
const figuresOf = (tree: DocumentTree): DocFigure[] => {
  const walk = (nodes: readonly DocNode[]): DocFigure[] => nodes.flatMap((n) => (n.kind === "figure" ? [n.figure] : n.kind === "group" ? walk(n.nodes) : []));
  return tree.sections.flatMap((s) => walk(s.nodes));
};
const drawnFigures = (tree: DocumentTree) => figuresOf(tree).filter((f) => f.content && figureDiagram(f.content).text);
/** The entities a block declares, by their quoted names (an entity line, with or without its attributes). */
const entitiesIn = (block: string) => new Set([...block.matchAll(/^ {2}"([^"]*)"(?: \{)?$/gm)].map((m) => m[1]!));

// ---- Mermaid's parsers ----

type Parser = { parse: (text: string) => unknown };
const VERSIONS = ["mermaid-v9", "mermaid-v10", "mermaid-v12"] as const;
const parsers = async () => Promise.all(VERSIONS.map(async (v) => [v, ((await import(v)) as { default: Parser }).default] as const));
/** "ok", or the parser's message (9.4.3's `parse` answers at once, the later ones a promise). */
const parsesOn = async (mermaid: Parser, block: string) =>
  Promise.resolve()
    .then(() => mermaid.parse(block))
    .then(
      () => "ok",
      (e: unknown) => String(e instanceof Error ? e.message : e),
    );

describe("every Mermaid block parses on old and new Mermaid (S34-03)", () => {
  it("on 9.4.3, 10.9.5 and 12.3.0", async () => {
    const all = [...new Set(cases.flatMap((c) => blocks(c.md)))];
    expect(all.length).toBeGreaterThan(10);
    for (const [version, mermaid] of await parsers()) for (const block of all) expect(await parsesOn(mermaid, block), `${version}:\n${block.slice(0, 400)}`).toBe("ok");
  }, 120_000);

  it("parses the hard names, types and a self-relationship on all three", async () => {
    const row = (name: string, type: string, o: Partial<FigureContent["cards"][number]["rows"][number]> = {}) => ({ name, type, pk: false, fk: false, pii: false, bk: false, calc: false, ...o });
    const content: FigureContent = {
      cards: [
        { id: "a", kind: "ent", name: 'Zamówienie "pilne"', rows: [row("ilość sztuk", "Decimal(18,2)", { pk: true, fk: true, pii: true, bk: true, calc: true }), row("PK", "String(100)"), row("1st_name", "")], inBlock: false },
        { id: "b", kind: "ent", name: "Größe & Maß", rows: [], inBlock: true },
        { id: "c", kind: "src", name: "dbo.orders", rows: [row("id", "varchar(max)", { pk: true })], inBlock: false },
        { id: "d", kind: "ent", name: 'Zamówienie "pilne"', rows: [], inBlock: false },
      ],
      frames: [],
      relationships: [
        { from: "a", to: "a", fromMin: 0, fromMany: false, toMin: 0, toMany: true, label: "parent; child: % # {x}" },
        { from: "a", to: "b", fromMin: 1, fromMany: true, toMin: 1, toMany: false, label: null },
      ],
      sourceKeys: [{ from: "c", to: "c", columns: [{ from: "id", to: "id" }] }],
      mappings: [],
      moduleLines: [],
      requirements: [],
    };
    const block = erDiagram(content);
    expect(block).toContain(`"Zamówienie 'pilne'" {`);
    expect(block).toContain(`"Zamówienie 'pilne' (2)"`);
    expect(block).toContain('Decimal ilo_sztuk PK, FK "Decimal(18,2) · ilość sztuk · PII · BK · ="');
    expect(block).toContain('String(100) PK_ "PK"');
    expect(block).toContain('untyped a_1st_name "1st_name"');
    expect(block).toContain('varchar id PK "varchar(max)"');
    expect(block).toContain('  "Größe & Maß"\n');
    expect(block).toContain(`"Zamówienie 'pilne'" |o--o{ "Zamówienie 'pilne'" : "parent; child: % # {x}"`);
    expect(block).toContain(`"Zamówienie 'pilne'" }|--|| "Größe & Maß" : ""`);
    for (const [version, mermaid] of await parsers()) {
      expect(await parsesOn(mermaid, block), version).toBe("ok");
      // the check can fail: a relationship without its label is refused by every version
      expect(await parsesOn(mermaid, 'erDiagram\n  "A" ||--o{ "B"'), version).not.toBe("ok");
    }
  }, 60_000);
});

describe("the nine rules, on every test document (S34-02)", () => {
  it.each(cases.map((c) => [c.name, c] as const))("%s", (_, c) => {
    const { md, tree } = c;
    const t = (key: LabelKey) => label(tree.language, key);
    const lines = prose(md);

    // rule 7 (MT1): the front matter names the document and its source; every value a quoted string
    expect(lines[0]).toBe("---");
    const end = lines.indexOf("---", 1);
    const front = Object.fromEntries(lines.slice(1, end).map((l) => [l.slice(0, l.indexOf(":")), JSON.parse(l.slice(l.indexOf(":") + 2)) as string]));
    for (const key of ["document", "workspace", "organization", "language", "source", "generated", "generator"]) expect(front[key], key).toBeTruthy();
    expect(front.source).toBe("live model");
    expect(front.language).toBe(tree.language);
    expect(front.generator).toBe("InfoMapper (InfoDocumenter)");
    expect(front.generated).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d[+-]\d\d:\d\d$/);
    // the title is the first heading; the line on Mermaid under it
    const headings = lines.filter((l) => /^#{1,6} /.test(l));
    expect(headings[0]).toBe(`# ${escapeText(tree.cover.title)}`);
    expect(md).toContain(escapeText(t("md_note")));

    // rule 6: headings never skip a level
    let prev = 0;
    for (const h of headings) {
      const level = /^#+/.exec(h)![0].length;
      expect(level, h).toBeLessThanOrEqual(prev + 1);
      prev = level;
    }

    // MT2: print-only things left out (the list of figures, the editor's hints, the watermark)
    expect(md).not.toContain(t("lof"));
    expect(md).not.toContain("Add a figure in the panel on the right.");
    if (tree.frame.watermark) expect(md).not.toContain(tree.frame.watermark);

    // MT3, rules 2 and 4: valid tables, no fake row, no empty column, every column named
    for (const table of tablesOf(md)) {
      const [header, , ...rows] = table;
      const name = header!.join(" | ");
      for (const r of table) expect(r.length, name).toBe(header!.length);
      for (const r of rows) if (header!.length > 1 && r[0]) expect(r.slice(1).some(Boolean), `a row with only "${r[0]}" in ${name}`).toBe(true);
      if (rows.length) header!.forEach((h, i) => expect(rows.some((r) => r[i]), `column "${h}" empty in ${name}`).toBe(true));
      for (const h of header!) expect(h, `a column without a name in ${name}`).not.toBe("");
      // rule 2: the long texts the sample turned into rows ("Direct copy", "Rule: …") never stand in a row's first cell
      for (const r of rows) expect(r[0]).not.toMatch(/^(Direct copy|Transformation|Rule:|Definition:|Note:)/);
    }

    // rule 3: values never run together
    expect(md).not.toMatch(/`[^`\n|]+``[^`\n|]+`/);
    expect(md).not.toMatch(/REQ-\d+[A-Za-zĄ-ż]/);
    expect(md).not.toMatch(/[a-zą-ż](Status|Priority|Coverage|Scope|Priorytet|Pokrycie|Zakres|Priorität|Abdeckung|Umfang):/);
    expect(md).not.toMatch(/\*\*[^\s*][^*\n]*\*\*\p{L}/u);
    expect(prose(md).filter((l) => / {2,}\S/.test(l) && !l.startsWith("  "))).toEqual([]);

    // rule 5: no legend; the notation as Mermaid's markers when the conventions show it
    for (const key of ["lg_ok", "lg_rev", "lg_dr", "lg_f", "lg_src", "lg_dot"] as const) expect(md).not.toContain(t(key));
    if (tree.sections.some((s) => s.type === "conv")) for (const m of ["`\\|\\|`", "`\\|o` / `o\\|`", "`}\\|` / `\\|{`", "`}o` / `o{`"]) expect(md).toContain(m);

    // rule 9: a draft mapping's status in brackets after it, an approved one without a word
    expect(md).not.toContain(`(${t("approved")})`);
    // the test documents of every section show every mapping: the draft second source of Customer.email is marked
    if (c.name.startsWith("every section")) expect(md).toMatch(new RegExp(`\`web_users\\.email\` \\(${t("draft")}\\)`));
  });

  it("has the same sections in the same order as the PDF, the contents linking to their headings (F12)", () => {
    for (const { md, tree } of cases) {
      const sectionHeadings = prose(md).filter((l) => l.startsWith("## ")).map((l) => l.slice(3));
      const expected = [...(tree.style.contents ? [tree.contents.heading] : []), ...tree.sections.map((s) => s.heading)].map(escapeText);
      expect(sectionHeadings).toEqual(expected);
      if (!tree.style.contents) continue;
      const slug = (h: string) => h.replace(/^#+ /, "").replace(/\\(.)/g, "$1").toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").trim().replace(/\s/g, "-");
      const slugs = new Set(prose(md).filter((l) => /^#+ /.test(l)).map(slug));
      const links = [...md.matchAll(/^- \[.*\]\(#([^)]+)\)$/gm)].map((m) => m[1]!);
      expect(links).toHaveLength(tree.sections.length);
      for (const l of links) expect(slugs.has(l) || slugs.has(l.replace(/-\d+$/, "")), l).toBe(true);
    }
  });
});

describe("each figure shows its own content (rule 1, S34-03)", () => {
  it("a block's entities are its figure's cards, each with its caption after it", () => {
    for (const { md, tree, name } of cases) {
      const figures = drawnFigures(tree);
      const found = blocks(md);
      expect(found.length, name).toBe(figures.length);
      figures.forEach((f, i) => {
        const names = f.content!.cards.map((c) => c.name.replace(/"/g, "'"));
        const declared = [...entitiesIn(found[i]!)];
        expect(declared.length, f.caption).toBe(names.length);
        for (const n of names) expect(declared.some((d) => d === n || d.startsWith(`${n} (`)), `${f.caption}: ${n}`).toBe(true);
        expect(md).toContain(`*${escapeText(`${f.word} ${f.number}`)}. ${escapeText(f.caption)}*`);
      });
      // figures of different canvases differ
      const byCaption = new Map(figures.map((f, i) => [f.caption, found[i]!]));
      if (byCaption.has("Customer & orders") && byCaption.has("Sales star")) expect(byCaption.get("Customer & orders")).not.toBe(byCaption.get("Sales star"));
    }
  });

  it("a star shows its fact and its dimensions only; a frame's figure only that frame's cards", () => {
    const { tree, md } = caseNamed("every section with frames and Polish names");
    const stars = figuresOf(tree).filter((f) => f.label);
    expect(stars.map((f) => f.label)).toEqual(["Fact Orders", "Fact Sales"]);
    expect(stars[1]!.content!.cards.map((c) => c.name)).toEqual(["Fact Sales", "Dim Customer", "Dim Date", "Dim Product"]);
    const frame = figuresOf(tree).find((f) => f.caption.endsWith("· Party & orders"))!;
    expect(frame.content!.cards.map((c) => c.name).sort()).toEqual(["Customer", "Sales Order"]);
    expect(frame.content!.frames.map((f) => f.name)).toEqual(["Party & orders"]);
    // the whole canvas: the concept frame and the collapsed area listed, the block's member without attributes
    const whole = figuresOf(tree).find((f) => f.caption === "Customer & orders")!;
    expect(whole.content!.frames.map((f) => [f.name, f.collapsed])).toEqual([
      ["Party & orders", false],
      ["Lines", true],
    ]);
    expect(md).toContain("- **Party & orders** (Concept): Customer, Sales Order");
    expect(md).toContain("- **Lines** (Free area, collapsed): Pozycja zamówienia");
    const block = blocks(md)[drawnFigures(tree).indexOf(whole)]!;
    expect(block).toContain('  "Pozycja zamówienia"\n');
    expect(block).toContain(`"Customer" ||--o{ "Sales Order" : "places 'online'"`);
    // its mappings with their statuses, and the requirement cards with what they trace to
    expect(md).toMatch(/- `web_users\.email` → `Customer\.email` \(Draft\) · type problem/);
    expect(md).toMatch(/- REQ-104 Order total equals the sum of its lines → Sales Order\.total_amount/);
  });

  it("keeps names with spaces and Polish letters in a block (rule 8)", () => {
    const all = blocks(caseNamed("every section with frames and Polish names").md).join("\n");
    expect(all).toContain('"Customer Address" {');
    expect(all).toContain('"Pozycja zamówienia"');
    expect(all).toMatch(/Integer ilo_sztuk "ilość sztuk"/);
  });
});

describe("the text itself", () => {
  const every = caseNamed("every section, below, row").md;

  it("escapes model text: markup stays text, a line never opens a block (F11)", () => {
    expect(every).toContain("Scope of this stage: the \\*core\\* model.\\\nAssumptions: a_b_c stays_as_is; \\<b>no markup\\</b> \\| pipes & \\[links\\](x).");
    expect(every).toContain("\\# Not a heading\\\n\\- not a list");
    expect(escapeText("_lead and trail_ a_b *x* `c` [l] <i> &amp; $5 ~s~ |")).toBe("\\_lead and trail\\_ a_b \\*x\\* \\`c\\` \\[l\\] \\<i> \\&amp; \\$5 \\~s\\~ \\|");
    expect(codeSpan("a`b")).toBe("``a`b``");
    expect(codeSpan("`x`")).toBe("`` `x` ``");
    expect(codeSpan("a|b", true)).toBe("`a\\|b`");
  });

  it("turns long texts under the row into a column at the table's end (rule 2, D2), after the table numbered", () => {
    expect(every).toMatch(/\| Attribute \| Type \| Keys \| Nullable \| Personal data \| Mapped from \| (Calculation \| )?Requirements \| Definition \|/);
    expect(every).toMatch(/\| Rule \| Note \|\n/);
    const after = caseNamed("every section, below, after").md;
    expect(after).toMatch(/^1\. \*\*(Rule|Note):\*\* /m);
  });

  // Łukasz's acceptance of step 3: in Source-to-target an unmapped attribute wrote "Not mapped" into "Target type", where
  // the PDF's tree puts it; the Markdown keeps every value in its own column
  it("keeps every value in its own column: an unmapped attribute's target type, Not mapped under Source column (S2T)", () => {
    const s2tTables = (md: string, language: "en" | "pl" | "de" = "en") =>
      tablesOf(md).filter((t) => t[0]!.includes(label(language, "target")) && t[0]!.includes(label(language, "ttype")));
    const notMapped = (language: "en" | "pl" | "de") => label(language, "notMapped");
    let unmappedRows = 0;
    for (const c of cases) {
      const language = c.tree.language as "en" | "pl" | "de";
      for (const t of s2tTables(c.md, language)) {
        const type = t[0]!.indexOf(label(language, "ttype"));
        for (const row of t.slice(2)) {
          expect(row[type], `${c.name}: ${row.join(" | ")}`).not.toBe(notMapped(language));
          if (row.includes(notMapped(language))) unmappedRows++;
        }
      }
    }
    expect(unmappedRows).toBeGreaterThan(0);

    // the demo's Customer.segment_code: its type, then "Not mapped" under Source column
    const row = (md: string, name: string) => s2tTables(md).flatMap((t) => t.slice(2).map((r) => Object.fromEntries(t[0]!.map((h, i) => [h, r[i]])))).find((r) => r.Target === `\`${name}\``)!;
    expect(row(every, "segment_code")).toMatchObject({ Target: "`segment_code`", "Target type": "`string(3)`", "Source column": "Not mapped" });

    // without Source column: the first other short column; with only the target's two: after the type
    const without = (columns: string[]) =>
      documentMarkdown({ tree: treeOf(documentOf([{ type: "s2t", options: { columns, unmapped: true } }]), demo), name: "S2T", generated: GENERATED });
    expect(row(without(["target", "targetType", "system", "status"]), "segment_code")).toMatchObject({ "Target type": "`string(3)`", System: "Not mapped", Status: "" });
    expect(row(without(["target", "targetType"]), "segment_code")).toMatchObject({ "Target type": "`string(3)` · Not mapped" });
    // an entity with no mapping keeps its Source column (a column stays when any row fills it)
    expect(without(["target", "targetType", "sourceColumn"])).toMatch(/\| Target \| Target type \| Source column \|\n\| --- \| --- \| --- \|\n\| `[a-z_]+` \| `[^`]+` \| Not mapped \|/);
  });

  it("writes icons as text: markers and dots; drops a column of lines (rule 4)", () => {
    expect(every).toContain("| `\\|\\|` / `\\|\\|` | Exactly one |");
    expect(every).toContain("| ● ○ |");
    expect(every).toMatch(/### Mapping statuses\n\n\| Status \| Meaning \|/);
  });

  it("names the file from the document's name (F9) and writes the time with its offset", () => {
    expect(markdownFileName("Słownik danych – zamówienia")).toBe("slownik-danych-zamowienia.md");
    expect(markdownFileName("Größe & Maß 2026")).toBe("grosse-mass-2026.md");
    expect(markdownFileName("Order management – S2T for the ETL team")).toBe("order-management-s2t-for-the-etl-team.md");
    expect(markdownFileName("–––")).toBe("document.md");
    expect(localTimestamp(new Date("2026-11-21T08:05:00Z"))).toMatch(/^2026-11-21T\d\d:05[+-]\d\d:\d\d$/);
  });

  it("writes the cover's fields in the front matter when set (D3), every value quoted", () => {
    const shared = caseNamed("demo: Retail Co – data dictionary").md;
    expect(shared.split("\n---\n")[0]).toBe(
      [
        "---",
        'document: "Retail Co – data dictionary"',
        'workspace: "Retail Co – DWH"',
        'organization: "InfoMate"',
        'language: "en"',
        'source: "live model"',
        `generated: "${GENERATED}"`,
        'generator: "InfoMapper (InfoDocumenter)"',
        'subtitle: "For the business"',
        'client: "Retail Co"',
        'version: "1.0"',
        'status: "Draft for review"',
        'prepared_by: "Łukasz"',
      ].join("\n"),
    );
  });

  it("writes Polish and German words, a status in the document's language", () => {
    const pl = caseNamed("every section in pl").md;
    expect(pl).toContain('language: "pl"');
    expect(pl).toContain(label("pl", "md_note"));
    expect(pl).toMatch(/`web_users\.email` \(Szkic\)/);
    const de = caseNamed("every section in de").md;
    expect(de).toContain(label("de", "md_note"));
    expect(de).toMatch(/`web_users\.email` \(Entwurf\)/);
  });
});

describe("Mermaid's words (Q4)", () => {
  it("keeps a plain name and type, changes the others and says so", () => {
    expect(attributeWord("customer_id")).toEqual({ word: "customer_id", changed: false });
    expect(attributeWord("e-mail")).toEqual({ word: "e-mail", changed: false });
    expect(attributeWord("Größe")).toEqual({ word: "Gr_e", changed: true });
    expect(attributeWord("FK")).toEqual({ word: "FK_", changed: true });
    expect(typeWord("String(100)")).toEqual({ word: "String(100)", changed: false });
    expect(typeWord("decimal(18,2)")).toEqual({ word: "decimal", changed: true });
    expect(typeWord("")).toEqual({ word: "untyped", changed: false });
  });

  it("draws a figure too large for Mermaid with headers only, then without its block (D4)", () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({ name: `attribute_number_${i}`, type: "String(100)", pk: false, fk: false, pii: false, bk: false, calc: false }));
    const content = (n: number): FigureContent => ({ cards: Array.from({ length: n }, (_, i) => ({ id: `c${i}`, kind: "ent", name: `Entity number ${i}`, rows, inBlock: false })), frames: [], relationships: [], sourceKeys: [], mappings: [], moduleLines: [], requirements: [] });
    expect(figureDiagram(content(5)).size).toBe("full");
    const big = figureDiagram(content(40));
    expect(big.size).toBe("headers");
    expect(big.text!.length).toBeLessThanOrEqual(MERMAID_MAX_CHARS);
    expect(figureDiagram(content(2500)).size).toBe("none");
  });
});

describe("a canvas too large for Mermaid (D4, F19): Performance test's 100 cards", () => {
  it("is drawn with headers only and says so; the block parses on all three", async () => {
    const db = buildSeed();
    addLargeWorkspace(db, "2026-11-21T08:00:00.000Z");
    const snapshot = workspaceSnapshotOf<ModuleTable>(db as unknown as StoredRows, LARGE_IDS.workspace, Object.fromEntries(DOCUMENT_TABLES.map((t) => [t, []])) as never)!;
    const definition = { ...documentOf([{ type: "figure", options: { figures: [newFigure("whole", LARGE_IDS.canvas)] } }]), name: "Performance" };
    const tree = buildDocument({ definition, state: documentStateFor(snapshot), types: DOCUMENT_SECTION_TYPES, date: "2026-11-21" });
    const [figure] = figuresOf(tree);
    expect(figure!.content!.cards.length).toBeGreaterThanOrEqual(100);
    expect(erDiagram(figure!.content!).length).toBeGreaterThan(MERMAID_MAX_CHARS);
    const md = documentMarkdown({ tree, name: "Performance", generated: GENERATED });
    expect(md).toContain(label("en", "md_tooLarge"));
    const [block] = blocks(md);
    expect(block!.length).toBeLessThanOrEqual(MERMAID_MAX_CHARS);
    expect(block).not.toContain(" {");
    for (const [version, mermaid] of await parsers()) expect(await parsesOn(mermaid, block!), version).toBe("ok");
  }, 60_000);
});
