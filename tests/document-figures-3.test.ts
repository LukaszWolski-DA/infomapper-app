// Slice 27, step 3 (S27-10's part): the sections with figures in a built document, from the demo model's stored rows:
// Diagrams (its canvases' names before their figures, the legend in its notation, its own notation and warning size, the
// placeholder), Model overview's figures before or after its content, the Data dictionary's concept frame, InfoCube's
// star diagram (its layout, the limit and its note, its editor line, none without a dimension or while the level is out
// of scope), numbering across sections with keys unique in the document, the list of figures (the style's switch), the
// presets' Diagrams made with the scope's canvases (D9), the recipe's new options read with their defaults, and the
// caption's draft in the preview. Pure: plain rows, no store.

import { describe, expect, it } from "vitest";
import { DOCUMENT_SECTION_KINDS, DOCUMENT_SECTION_TYPES, DOCUMENT_TABLES, documentStateFor } from "@/compose/documents";
import { addFullDemoData } from "@/compose/seed";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import type { DevDb } from "@/data/local/schema";
import { cardHeightFor } from "@/domain/model/card-size";
import type { DocFigure, DocNode } from "@/domain/document/content";
import { workspaceSnapshotOf, type StoredRows } from "@/domain/model/workspace-model";
import type { Frame, ModuleTable } from "@/domain/types";
import { CUBE_SECTION_KIND } from "@/modules/infocube/domain/document-section";
import { STAR_DIMENSION_WIDTH, STAR_FACT_WIDTH, starLayout } from "@/modules/infocube/domain/star";
import { buildDocument, type DocumentTree } from "@/modules/infodocumenter/domain/document";
import { diagramCanvases } from "@/modules/infodocumenter/domain/figures";
import { newSection, presetOf, presetSections } from "@/modules/infodocumenter/domain/presets";
import { newFigure } from "@/modules/infodocumenter/domain/sections";
import { defaultStyle } from "@/modules/infodocumenter/domain/style";
import type { DocumentStyle } from "@/modules/infodocumenter/domain/types";
import { withDrafts } from "@/modules/infodocumenter/ui/drafts";

const WS = SEED_IDS.wsRetailDwh;
let n = 0;
const sid = () => `00000000-0000-7000-8000-${String(++n).padStart(12, "0")}`;

function demo(change?: (db: DevDb) => void): DevDb {
  const db = buildSeed();
  addFullDemoData(db);
  change?.(db);
  return db;
}
const snapshotOf = (db: DevDb) => {
  const modules = Object.fromEntries(DOCUMENT_TABLES.map((t) => [t, (db as unknown as Record<string, unknown[]>)[t] ?? []]));
  return workspaceSnapshotOf<ModuleTable>(db as unknown as StoredRows, WS, modules as never)!;
};
const canvasNamed = (db: DevDb, name: string) => db.canvas.find((c) => c.name === name && c.workspace_id === WS && c.deleted_at === null)!;
const entityNamed = (db: DevDb, name: string) => db.entity.find((e) => e.name === name && e.workspace_id === WS && e.deleted_at === null)!;

type Section = { type: string; options?: Record<string, unknown>; newPage?: boolean };
function build(db: DevDb, sections: Section[], style: Partial<DocumentStyle> = {}, scope: Partial<{ dimensional: boolean; concepts: string[] }> = {}): DocumentTree {
  const state = documentStateFor(snapshotOf(db));
  return buildDocument({
    definition: {
      name: "Figures",
      author_id: SEED_IDS.userLukasz,
      scope: { projects: [], concepts: [], logical: true, dimensional: true, mappings: "all", ...scope },
      cover: { title: null, subtitle: null, version: null, status: null, preparedBy: null },
      style: { ...defaultStyle(), ...style },
      sections: sections.map((s) => ({ id: sid(), type: s.type, on: true, heading: null, newPage: s.newPage ?? true, options: { ...DOCUMENT_SECTION_KINDS.get(s.type)!.defaults(), ...s.options } })),
    },
    state,
    types: DOCUMENT_SECTION_TYPES,
    date: "2026-11-15",
  });
}
const flat = (nodes: readonly DocNode[]): DocNode[] => nodes.flatMap((x) => (x.kind === "group" ? flat(x.nodes) : [x]));
const figuresOf = (nodes: readonly DocNode[]): DocFigure[] => flat(nodes).flatMap((x) => (x.kind === "figure" ? [x.figure] : []));

describe("Diagrams (slice 27, step 3)", () => {
  it("draws its figures that are on, each canvas's name once before its figures, then the legend", () => {
    const db = demo();
    const co = canvasNamed(db, "Customer & orders").id, ol = canvasNamed(db, "Order lines & products").id;
    const tree = build(db, [{ type: "diagrams", options: { figures: [newFigure("a", co), { ...newFigure("b", co), view: "custom" }, { ...newFigure("x", ol), on: false }, newFigure("c", ol)] } }]);
    const nodes = tree.sections[0]!.nodes;
    expect(nodes.map((x) => (x.kind === "heading" ? `h:${x.text}` : x.kind))).toEqual(["h:Customer & orders", "figure", "figure", "h:Order lines & products", "figure", "legend"]);
    expect(tree.sections[0]!.heading).toBe("Diagrams");
    // the canvases' names are its subsections, numbered (the prototype's h3)
    expect(nodes.filter((x) => x.kind === "heading").map((x) => (x as { number?: string }).number)).toEqual(["1.1", "1.2"]);
    const legend = nodes.at(-1) as Extract<DocNode, { kind: "legend" }>;
    expect(legend.title).toBe("Legend");
    // InfoCube is on in the demo: the dimensional mapping's line is in the legend
    expect(legend.items.map((i) => i.mark)).toEqual(["rel-ie", "map-ok", "map-review", "map-draft", "map-warn", "map-rule", "cube", "src", "dots"]);
    expect(legend.items[0]!.text).toBe("Relationship (crow's foot: many; bar: one; circle: optional)");
  });

  it("draws its figures and legend in its own notation; its warning size in place of the document's; the legend off", () => {
    const db = demo();
    const co = canvasNamed(db, "Customer & orders").id;
    const uml = build(db, [{ type: "diagrams", options: { figures: [newFigure("a", co)], notation: "uml" } }]);
    expect(figuresOf(uml.sections[0]!.nodes)[0]!.svg).toContain('class="mult"');
    expect((uml.sections[0]!.nodes.at(-1) as Extract<DocNode, { kind: "legend" }>).items[0]).toEqual({ mark: "rel-uml", text: "Relationship (UML multiplicities)" });
    const ie = build(db, [{ type: "diagrams", options: { figures: [newFigure("a", co)] } }], { notation: "uml" });
    expect(figuresOf(ie.sections[0]!.nodes)[0]!.svg).toContain('class="mult"');
    expect(figuresOf(build(db, [{ type: "diagrams", options: { figures: [newFigure("a", co)], notation: "ie" } }], { notation: "uml" }).sections[0]!.nodes)[0]!.svg).not.toContain('class="mult"');
    // 75 %: names at 7 pt; the document's 8 pt warns, Diagrams' own 7 pt does not
    const at = (warnPt: number) => figuresOf(build(db, [{ type: "diagrams", options: { figures: [{ ...newFigure("a", co), size: "75" }], warnPt } }], { smallestPt: 8 }).sections[0]!.nodes)[0]!.summary;
    expect(at(0)).toContain(" · smaller than 8 pt: try one figure per frame, A3 paper, or the page outline on the canvas");
    expect(at(7)).not.toContain("smaller than");
    expect(build(db, [{ type: "diagrams", options: { figures: [newFigure("a", co)], legend: false } }]).sections[0]!.nodes.some((x) => x.kind === "legend")).toBe(false);
  });

  it("says what to do without a figure in the document; the legend in the document's language", () => {
    const db = demo();
    const co = canvasNamed(db, "Customer & orders").id;
    expect(build(db, [{ type: "diagrams", options: { figures: [{ ...newFigure("a", co), on: false }] } }]).sections[0]!.nodes).toEqual([
      { kind: "paragraph", runs: [{ text: "Tick or add a figure in the panel on the right.", muted: true }], placeholder: true },
    ]);
    const pl = build(db, [{ type: "diagrams", options: { figures: [newFigure("a", co)] } }], { language: "pl" });
    expect(pl.sections[0]!.heading).toBe("Diagramy");
    expect((pl.sections[0]!.nodes.at(-1) as Extract<DocNode, { kind: "legend" }>).title).toBe("Legenda");
    const de = build(db, [{ type: "diagrams", options: { figures: [newFigure("a", co)] } }], { language: "de", colours: "mono" });
    const legend = de.sections[0]!.nodes.at(-1) as Extract<DocNode, { kind: "legend" }>;
    expect([legend.title, legend.mono, legend.items[1]!.text]).toEqual(["Legende", true, "Mapping, freigegeben"]);
  });
});

describe("Model overview's and the dictionary's figures (slice 27, step 3, D5)", () => {
  it("puts Model overview's figures right after the description, or below its content", () => {
    const db = demo((d) => (d.workspace.find((w) => w.id === WS)!.description = "The warehouse of Retail Co."));
    const co = canvasNamed(db, "Customer & orders").id;
    const kinds = (figuresAt: string) => build(db, [{ type: "overview", options: { figures: [newFigure("a", co)], figuresAt } }]).sections[0]!.nodes.map((x) => x.kind);
    expect(kinds("start")).toEqual(["paragraph", "figure", "table", "list"]);
    expect(kinds("end")).toEqual(["paragraph", "table", "list", "figure"]);
    // a stored overview without the options reads with no figure, below the content
    expect(DOCUMENT_SECTION_KINDS.get("overview")!.options.parse({ stats: true, concepts: true })).toEqual({ stats: true, concepts: true, figures: [], figuresAt: "end" });
  });

  it("draws a concept's frame at its group's start, from the first canvas of the scope that has one", () => {
    const frameId = "00000000-0000-7000-8000-00000000f00d";
    const db = demo((d) => {
      const canvas = canvasNamed(d, "Customer & orders");
      const customer = entityNamed(d, "Customer");
      const item = d.canvas_item.find((i) => i.canvas_id === canvas.id && i.entity_id === customer.id)!;
      const frame: Frame = { ...canvas, id: frameId, canvas_id: canvas.id, name: "Party", kind: "concept", concept_id: customer.concept_id, source_system_id: null, color: null, x: item.x - 40, y: item.y - 40, width: 340, height: 520, collapsed: false } as unknown as Frame;
      d.frame.push(frame);
      item.frame_id = frameId;
    });
    const customer = entityNamed(db, "Customer");
    const off = build(db, [{ type: "dict" }]);
    expect(figuresOf(off.sections[0]!.nodes)).toHaveLength(0);
    const on = build(db, [{ type: "dict", options: { conceptFigures: true } }]);
    const nodes = flat(on.sections[0]!.nodes);
    const at = nodes.findIndex((x) => x.kind === "heading" && x.level === 2 && x.text === db.concept.find((c) => c.id === customer.concept_id)!.name);
    expect(nodes[at + 1]!.kind).toBe("figure");
    const f = figuresOf(on.sections[0]!.nodes);
    expect(f.map((x) => x.caption)).toEqual(["Customer & orders · Party"]);
    expect(f[0]!.svg).toContain(">Customer</text>");
    expect(f[0]!.svg).not.toContain(">Sales Order</text>");
  });
});

describe("the star diagram (slice 27, step 3, Q5)", () => {
  it("places the fact in the middle and up to six dimensions left and right, more above and below, with the canvas's heights", () => {
    const attrs = new Map<string, { is_primary_key: boolean; is_foreign_key: boolean; is_business_key: boolean }[]>();
    const key = { is_primary_key: true, is_foreign_key: false, is_business_key: false }, plain = { is_primary_key: false, is_foreign_key: false, is_business_key: false };
    attrs.set("F", [key, key, plain, plain]);
    for (let i = 0; i < 10; i++) attrs.set(`D${i}`, [key, plain, plain]);
    const of = (id: string) => (attrs.get(id) ?? []) as never;
    const two = starLayout("F", ["D0", "D1", "D0"], of, "keys", 12)!;
    expect(two.cards.map((c) => [c.entityId, c.x, c.width, c.rowFilter])).toEqual([
      ["F", 0, STAR_FACT_WIDTH, "all"],
      ["D0", -STAR_DIMENSION_WIDTH - 100, STAR_DIMENSION_WIDTH, "keys"],
      ["D1", STAR_FACT_WIDTH + 100, STAR_DIMENSION_WIDTH, "keys"],
    ]);
    // centred on the fact's middle, its height the canvas's (all its rows; the dimension's key only)
    const factH = cardHeightFor(4), dimH = cardHeightFor(1);
    expect(two.cards[1]!.y).toBe(factH / 2 - dimH / 2);
    expect([two.shown, two.all]).toEqual([2, 2]);
    const all = starLayout("F", ["D0"], of, "all", 12)!;
    expect(all.cards[1]!.y).toBe(factH / 2 - cardHeightFor(3) / 2);
    // eight: left, right, top, bottom in turn; the limit keeps the first ones and counts all
    const eight = starLayout("F", ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7"], of, "keys", 12)!;
    const side = (id: string) => {
      const c = eight.cards.find((x) => x.entityId === id)!;
      return c.x === -STAR_DIMENSION_WIDTH - 100 ? "L" : c.x === STAR_FACT_WIDTH + 100 ? "R" : c.y < 0 ? "T" : "B";
    };
    expect(["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7"].map(side)).toEqual(["L", "R", "T", "B", "L", "R", "T", "B"]);
    const capped = starLayout("F", ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9"], of, "keys", 6)!;
    expect([capped.shown, capped.all, capped.cards.length]).toEqual([6, 10, 7]);
    expect(starLayout("F", [], of, "keys", 12)).toBeNull();
  });

  it("draws one star per fact in the Dimensional model, after its type and grain, with its caption and the editor's line", () => {
    const db = demo();
    const tree = build(db, [{ type: "cube.dim" }]);
    const nodes = flat(tree.sections[0]!.nodes);
    const stars = figuresOf(tree.sections[0]!.nodes);
    expect(stars.map((f) => f.caption)).toEqual(["Star schema of Fact Orders", "Star schema of Fact Sales"]);
    expect(stars.map((f) => f.label)).toEqual(["Fact Orders", "Fact Sales"]);
    const fact = nodes.findIndex((x) => x.kind === "heading" && x.text === "Fact Sales");
    expect(nodes.slice(fact + 1, fact + 6).map((x) => x.kind)).toEqual(["meta", "paragraph", "table", "figure", "heading"]);
    // drawn from the model, relationships only with their role pills; never a canvas's other lines or a status mark
    const sales = stars[1]!.svg;
    for (const name of ["Fact Sales", "Dim Customer", "Dim Product", "Dim Date"]) expect(sales).toContain(`>${name}</text>`);
    expect(sales).toContain(">Order date</text>");
    expect(sales).not.toMatch(/<g class="map /);
    expect(tree.figures.map((f) => [f.label, f.sectionId === tree.sections[0]!.id])).toEqual([
      ["Fact Orders", true],
      ["Fact Sales", true],
    ]);
    // in Polish: the caption in the document's words
    expect(figuresOf(build(db, [{ type: "cube.dim" }], { language: "pl" }).sections[0]!.nodes)[1]!.caption).toBe("Schemat gwiazdy: Fact Sales");
  });

  it("says how many dimensions are shown beyond the limit; none with the star off or the level out of scope; its figures from canvases first", () => {
    const db = demo();
    const sales = entityNamed(db, "Fact Sales");
    // the limit at its smallest (6) cannot cut the demo's three; the note comes from the layout's counts
    const capped = build(db, [{ type: "cube.dim", options: { starMax: 6 } }]);
    expect(figuresOf(capped.sections[0]!.nodes)[1]!.caption).toBe("Star schema of Fact Sales");
    expect(figuresOf(build(db, [{ type: "cube.dim", options: { star: false } }]).sections[0]!.nodes)).toHaveLength(0);
    expect(figuresOf(build(db, [{ type: "cube.dim" }], {}, { dimensional: false }).sections[0]!.nodes)).toHaveLength(0);
    const co = canvasNamed(db, "Sales star").id;
    const withCanvas = build(db, [{ type: "cube.dim", options: { figures: [{ ...newFigure("c", co), caption: "Arranged by hand" }] } }]);
    expect(withCanvas.sections[0]!.nodes[0]!.kind).toBe("figure");
    expect(figuresOf(withCanvas.sections[0]!.nodes).map((f) => f.caption)).toEqual(["Arranged by hand", "Star schema of Fact Orders", "Star schema of Fact Sales"]);
    expect(sales.id).toBeTruthy();
  });

  it("reads a stored Dimensional model without the star's options with the prototype's defaults", () => {
    const stored = { facts: true, dimensions: true, dimensionDefinitions: true, measures: true, relationships: true, feeds: true };
    expect(CUBE_SECTION_KIND.options.parse(stored)).toEqual({ ...stored, star: true, starRows: "keys", starSize: "auto", starOrientation: "doc", starMax: 12, figures: [] });
    expect(CUBE_SECTION_KIND.options.safeParse({ ...stored, starMax: 7 }).success).toBe(false);
  });
});

describe("numbering and the list of figures (slice 27, step 3, F6, D10)", () => {
  it("numbers figures across sections in document order, each key unique in the document", () => {
    const db = demo();
    const co = canvasNamed(db, "Customer & orders").id;
    const tree = build(db, [
      { type: "figure", options: { figures: [newFigure("a", co)] } },
      { type: "overview", options: { figures: [newFigure("a", co)] } },
      { type: "diagrams", options: { figures: [newFigure("a", co)], legend: false } },
      { type: "cube.dim" },
    ]);
    expect(tree.figures.map((f) => f.number)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(tree.figures.map((f) => f.key)).size).toBe(5);
    expect(tree.figures.map((f) => f.key.split(":")[0])).toEqual([tree.sections[0]!.id, tree.sections[1]!.id, tree.sections[2]!.id, tree.sections[3]!.id, tree.sections[3]!.id]);
    expect(tree.listOfFigures).toBeNull();
  });

  it("lists the figures after the contents while the style's switch is on and a figure is drawn", () => {
    const db = demo();
    const co = canvasNamed(db, "Customer & orders").id;
    const on = build(db, [{ type: "figure", options: { figures: [{ ...newFigure("a", co), caption: "First" }] } }], { listOfFigures: true });
    expect(on.listOfFigures).toEqual({ heading: "List of figures" });
    expect(on.figures.map((f) => [f.number, f.caption, f.anchor])).toEqual([[1, "First", "fg-1"]]);
    expect(build(db, [{ type: "text", options: { body: "" } }], { listOfFigures: true }).listOfFigures).toBeNull();
    expect(build(db, [{ type: "figure", options: { figures: [newFigure("a", co)] } }], { listOfFigures: true, language: "de" }).listOfFigures).toEqual({ heading: "Abbildungsverzeichnis" });
  });
});

describe("the presets' Diagrams (slice 27, step 3, D9)", () => {
  it("takes the scope's canvases: the chosen projects' or every project's, in the order made and each in tab order, once each", () => {
    const projects = [
      { id: "p2", created_at: "2026-02-01" },
      { id: "p1", created_at: "2026-01-01" },
    ];
    const link = (project_id: string, canvas_id: string, sort_order: number) => ({ project_id, canvas_id, sort_order, workspace_id: "w", added_at: "2026-01-01", added_by: "u" });
    const links = [link("p1", "b", 1), link("p1", "a", 0), link("p2", "c", 0), link("p2", "a", 1)];
    expect(diagramCanvases(projects, links, [])).toEqual(["a", "b", "c"]);
    expect(diagramCanvases(projects, links, ["p2"])).toEqual(["c", "a"]);
    // a chosen project that is gone reads as no choice
    expect(diagramCanvases(projects, links, ["gone"])).toEqual(["a", "b", "c"]);
  });

  it("makes the dictionary's Diagrams keys-only with relationships, the specification's as on the canvas, one figure per canvas", () => {
    const db = demo();
    const ws = db.workspace.find((w) => w.id === WS)!;
    const canvases = ["c1", "c2"];
    const dictionary = presetSections(presetOf("dictionary"), DOCUMENT_SECTION_KINDS.values(), ws, sid, canvases);
    const d = dictionary.find((s) => s.type === "diagrams")!;
    expect(dictionary.map((s) => s.type).indexOf("diagrams")).toBe(dictionary.map((s) => s.type).indexOf("conv") + 1);
    expect((d.options.figures as { canvasId: string }[]).map((f) => f.canvasId)).toEqual(canvases);
    expect(d.options.figures).toEqual([expect.objectContaining({ view: "custom", rows: "keys", lines: { rel: true, map: false, src: false, cube: false }, status: false, frameId: null, size: "auto" }), expect.anything()]);
    const s2t = presetSections(presetOf("s2t"), DOCUMENT_SECTION_KINDS.values(), ws, sid, canvases).find((s) => s.type === "diagrams")!;
    expect(s2t.options.figures).toEqual([expect.objectContaining({ view: "canvas", lines: { rel: true, map: true, src: true, cube: true }, status: true }), expect.anything()]);
    expect(presetOf("dictionary").description).toBe("Definitions, personal data and requirements, with key-only diagrams. No technical mapping detail.");
    expect(presetOf("s2t").description).toBe("Every mapping with rules, types and status; source tables; full diagrams with mapping lines.");
  });
});

describe("a caption's draft in the preview (slice 27, step 3)", () => {
  it("draws the caption typed over the stored one, and nothing once the stored one moved", () => {
    const section = newSection("s", "figure", { figures: [newFigure("f", "c"), newFigure("g", "c")] });
    const doc = { name: "D", audience: null, cover: { title: null, subtitle: null, version: null, status: null, preparedBy: null }, style: defaultStyle(), sections: [section] };
    const drawn = withDrafts(doc, new Map([["fig:s:f", { text: " Typed ", base: "" }]]));
    expect((drawn.sections[0]!.options.figures as { caption: string }[]).map((f) => f.caption)).toEqual(["Typed", ""]);
    const moved = withDrafts(doc, new Map([["fig:s:f", { text: "Typed", base: "Older" }]]));
    expect(moved).toBe(doc);
  });
});
