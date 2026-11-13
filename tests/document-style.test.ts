// Slice 26, step 4: the style's effect on the document. The page's size and orientation (Paged.js's `@page size`) and
// the title page's height; the templates, the accent, black and white, banded rows and numbering as CSS; in the tree the
// numbered sections and subsections, Compact's sections running on, the title page and contents switches, the document's
// own language (Q8), keep-rows on the dictionary's entities, the notation in the conventions; the header and footer
// fields as drafts in the preview.

import { describe, expect, it } from "vitest";
import { DOCUMENT_SECTION_TYPES, DOCUMENT_TABLES, documentStateFor } from "@/compose/documents";
import { addFullDemoData } from "@/compose/seed";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import type { DevDb } from "@/data/local/schema";
import type { DocNode } from "@/domain/document/content";
import { workspaceSnapshotOf, type StoredRows } from "@/domain/model/workspace-model";
import type { ModuleTable } from "@/domain/types";
import { buildDocument, type DocumentTree } from "@/modules/infodocumenter/domain/document";
import { INFODOC_SECTION_KINDS } from "@/modules/infodocumenter/domain/sections";
import { defaultStyle } from "@/modules/infodocumenter/domain/style";
import type { DocumentStyle } from "@/modules/infodocumenter/domain/types";
import { documentCss, pageSize, quickSheetCss, styleCss } from "@/modules/infodocumenter/ui/document-css";
import { nextDraft, withDrafts } from "@/modules/infodocumenter/ui/drafts";

const WS = SEED_IDS.wsRetailDwh;
let n = 0;
const sid = () => `00000000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
const FRAME = { headerLeft: "Org · T", headerRight: "", footerLeft: "W · Live", footerRight: "Page {page} of {pages}", watermark: "DRAFT" };

function demo(change?: (db: DevDb) => void): DevDb {
  const db = buildSeed();
  addFullDemoData(db);
  change?.(db);
  return db;
}
const state = (db = demo()) =>
  documentStateFor(workspaceSnapshotOf<ModuleTable>(db as unknown as StoredRows, WS, Object.fromEntries(DOCUMENT_TABLES.map((t) => [t, (db as unknown as Record<string, unknown[]>)[t] ?? []])) as never)!);

function doc(types: readonly (string | { type: string; options?: Record<string, unknown>; newPage?: boolean })[], style: Partial<DocumentStyle> = {}, db?: DevDb): DocumentTree {
  return buildDocument({
    definition: {
      name: "D",
      author_id: SEED_IDS.userLukasz,
      scope: { projects: [], concepts: [], logical: true, dimensional: true, mappings: "all" },
      cover: { title: null, subtitle: null, version: null, status: null, preparedBy: null },
      style: defaultStyle(style),
      sections: types.map((x) => {
        const t = typeof x === "string" ? { type: x } : x;
        const kind = INFODOC_SECTION_KINDS.find((k) => k.type === t.type)!;
        return { id: sid(), type: t.type, on: true, heading: null, newPage: t.newPage ?? true, options: { ...kind.defaults(), ...t.options } };
      }),
    },
    state: state(db),
    types: DOCUMENT_SECTION_TYPES,
    date: "2026-11-13",
  });
}
const flat = (nodes: readonly DocNode[]): DocNode[] => nodes.flatMap((x) => (x.kind === "group" ? flat(x.nodes) : [x]));

describe("the page: paper, orientation, the title page's height", () => {
  it("writes Paged.js's named size and the title page's height from the page's", () => {
    expect(pageSize({ paper: "A3", orientation: "landscape" })).toEqual({ w: 420, h: 297 });
    expect(pageSize({ paper: "A4", orientation: "portrait" })).toEqual({ w: 210, h: 297 });
    const a4 = documentCss(FRAME);
    expect(a4).toContain("@page{size:A4 portrait;");
    expect(a4).toContain(".dcover{min-height:248mm}");
    const a3 = documentCss(FRAME, { ...defaultStyle(), paper: "A3", orientation: "landscape" });
    expect(a3).toContain("@page{size:A3 landscape;");
    expect(a3).toContain(".dcover{min-height:248mm}");
    expect(documentCss(FRAME, { ...defaultStyle(), orientation: "landscape" })).toContain(".dcover{min-height:161mm}");
    expect(documentCss(FRAME, { ...defaultStyle(), paper: "A3" })).toContain(".dcover{min-height:371mm}");
  });

  it("the quick sheet takes the page's size and Compact's padding", () => {
    expect(quickSheetCss({ paper: "A3", orientation: "landscape", template: "standard" })).toContain("width:420mm;min-height:297mm;padding:18mm");
    expect(quickSheetCss({ paper: "A4", orientation: "portrait", template: "compact" })).toContain("width:210mm;min-height:297mm;padding:14mm");
  });
});

describe("the look: templates, accent, black and white, banded rows, numbering", () => {
  const css = (style: Partial<DocumentStyle>) => styleCss({ ...defaultStyle(), ...style });
  it("sets the accent, and black and white overrides it", () => {
    expect(css({ accent: "teal" })).toContain("--dacc:#0B7A66");
    expect(css({ accent: "teal", colours: "mono" })).toContain("--dacc:#111111");
    expect(css({ colours: "mono" })).toContain(".dsw{background:#777!important}");
    expect(css({})).not.toContain("#777");
  });
  it("Formal sets serif body text with sans headings; Compact smaller type; Standard neither", () => {
    expect(css({ template: "formal" })).toContain('font-family:var(--font-plex-serif),"IBM Plex Serif",Georgia');
    expect(css({ template: "compact" })).toContain("font-size:9pt;line-height:1.4");
    expect(css({})).not.toContain("--font-plex-serif");
    expect(css({})).not.toContain("font-size:9pt");
  });
  it("bands every second row only when chosen; hides the numbers when not numbered", () => {
    expect(css({ banded: true })).toContain("table.dt tbody.even td{background:var(--dsoft)}");
    expect(css({})).not.toContain("tbody.even");
    expect(css({ numbers: false })).toContain(".dnum{display:none}");
  });
});

describe("the tree: numbering, Compact, the switches, the language, keep-rows, the notation", () => {
  it("numbers the sections and their subsections, and their contents' entries", () => {
    const tree = doc(["text", "dict"]);
    expect(tree.sections.map((s) => s.number)).toEqual(["1", "2"]);
    expect(tree.contents.entries.map((e) => e.number)).toEqual(["1", "2"]);
    const numbered = flat(tree.sections[1]!.nodes).filter((x): x is Extract<DocNode, { kind: "heading" }> => x.kind === "heading" && x.level === 2);
    expect(numbered.map((h) => h.number)).toEqual(["2.1", "2.2", "2.3", "2.4"]);
    expect(doc(["text", "dict"], { numbers: false }).sections.map((s) => s.number)).toEqual([null, null]);
  });

  it("runs sections on with Compact, whatever each section says", () => {
    expect(doc(["text", "dict"]).sections.map((s) => s.newPage)).toEqual([true, true]);
    expect(doc(["text", { type: "dict", newPage: false }]).sections.map((s) => s.newPage)).toEqual([true, false]);
    expect(doc(["text", "dict"], { template: "compact" }).sections.map((s) => s.newPage)).toEqual([false, false]);
  });

  it("follows the document's own language, else the workspace's (Q8)", () => {
    expect(doc(["dict"]).sections[0]!.heading).toBe("Data dictionary");
    expect(doc(["dict"], { language: "de" }).sections[0]!.heading).toBe("Datenkatalog");
    const pl = demo((d) => {
      for (const w of d.workspace) if (w.id === WS) w.doc_language = "pl";
    });
    expect(doc(["dict"], {}, pl).sections[0]!.heading).toBe("Słownik danych");
    expect(doc(["dict"], { language: "en" }, pl).sections[0]!.heading).toBe("Data dictionary");
  });

  it("keeps an entity with at most the chosen rows on one page; never with 0", () => {
    const groups = (keepRows: DocumentStyle["keepRows"]) => doc(["dict"], { keepRows }).sections[0]!.nodes.filter((x): x is Extract<DocNode, { kind: "group" }> => x.kind === "group");
    const by15 = groups(15);
    expect(by15.some((g) => g.keep)).toBe(true);
    for (const g of by15) {
      const table = g.nodes.find((x): x is Extract<DocNode, { kind: "table" }> => x.kind === "table");
      if (table) expect(!!g.keep, (g.nodes[0] as { text: string }).text).toBe(table.rows.length <= 15);
    }
    expect(groups(0).some((g) => g.keep)).toBe(false);
  });

  it("draws the conventions' ends in the document's notation", () => {
    const ends = (notation: DocumentStyle["notation"]) =>
      (doc(["conv"], { notation }).sections[0]!.nodes.find((x) => x.kind === "table") as Extract<DocNode, { kind: "table" }>).rows.map((r) => r.cells[0]![0]!.end!.notation);
    expect(ends("ie")).toEqual(["ie", "ie", "ie", "ie"]);
    expect(ends("uml")).toEqual(["uml", "uml", "uml", "uml"]);
  });

  it("fills the header and footer fields; the running header off empties the header; the mark off empties the watermark", () => {
    const frame = doc([], { header: { left: "{title} {pagelabel}", right: "{org} {page}" }, footer: { left: "{client} · {date}", right: "{page}/{pages}" } }).frame;
    expect(frame).toEqual({ headerLeft: "D", headerRight: "InfoMate {page}", footerLeft: "Retail Co · 2026-11-13", footerRight: "{page}/{pages}", watermark: "DRAFT · live model" });
    expect(documentCss(frame)).toContain('@bottom-right{content:counter(page) "/" counter(pages);');
    expect(doc([], { runningHeader: false, watermark: false }).frame).toMatchObject({ headerLeft: "", headerRight: "", watermark: "" });
  });
});

describe("the header and footer fields as the preview's drafts", () => {
  it("draws a typed field over the value it was typed on", () => {
    const recipe = { name: "D", audience: null, cover: { title: null, subtitle: null, version: null, status: null, preparedBy: null }, sections: [], style: defaultStyle() };
    const drafts = new Map([["style.footer.right", nextDraft(recipe, undefined, "style.footer.right", "{pagelabel} · Confidential")]]);
    expect(withDrafts(recipe, drafts).style.footer).toEqual({ left: null, right: "{pagelabel} · Confidential" });
    expect(withDrafts({ ...recipe, style: defaultStyle({ footer: { left: null, right: "Theirs" } }) }, drafts).style.footer.right).toBe("Theirs");
  });
});
