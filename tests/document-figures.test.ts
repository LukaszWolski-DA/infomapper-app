// Slice 27 (S27-10's part in step 2): a figure drawn by the builder from the demo model's stored rows (`figureDrawing`),
// with the canvas's own rules: its cards at the canvas's places and heights, their rows by the view's row choice, the
// line kinds, the status marks, no notes or label marks (C4), what is out of scope left out (D3), a frame's figure, the
// lines that say a canvas or frame is gone (D11), the escaping and the faces used (Q2); the Figure section in a built
// document: its nodes, the numbering (F6), the editor's line (F15), the placeholder, a new entry on the same page (F7);
// the recipe's figure fields and the style's two new fields read with their defaults (F8). Pure: plain rows, no store.

import { describe, expect, it } from "vitest";
import { DOCUMENT_SECTION_KINDS, DOCUMENT_SECTION_TYPES, DOCUMENT_TABLES, documentStateFor } from "@/compose/documents";
import { addFullDemoData } from "@/compose/seed";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import type { DevDb } from "@/data/local/schema";
import { buildCards } from "@/domain/canvas/card-data";
import { cardHeight, cardWidth } from "@/domain/canvas/geometry";
import type { DocFigure, DocNode } from "@/domain/document/content";
import { ENGLISH_FIGURE_WORDS, figureDrawing, type FigureInput, type FigureSpec } from "@/domain/document/figure";
import { workspaceSnapshotOf, type StoredRows } from "@/domain/model/workspace-model";
import type { Frame, ModuleTable } from "@/domain/types";
import { buildDocument } from "@/modules/infodocumenter/domain/document";
import { presetSections, presetOf } from "@/modules/infodocumenter/domain/presets";
import { figureEntry, newFigure } from "@/modules/infodocumenter/domain/sections";
import { defaultStyle, upgradeDocument } from "@/modules/infodocumenter/domain/style";

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

function inputOf(db: DevDb, scope: Partial<FigureInput["scope"]> = {}, extra: Partial<FigureInput> = {}): FigureInput {
  const snapshot = snapshotOf(db);
  const state = documentStateFor(snapshot);
  return {
    snapshot,
    requirements: state.requirements,
    scope: { entityIds: new Set(snapshot.model.entities.map((e) => e.id)), tableIds: new Set(snapshot.model.sourceTables.map((t) => t.id)), logical: true, dimensional: true, mappings: "all", ...scope },
    dimensionalOn: state.modules.dimensionalOn,
    modules: state.modules.figures,
    language: "en",
    words: ENGLISH_FIGURE_WORDS,
    notation: "ie",
    mono: false,
    ...extra,
  };
}
const asCanvas = (canvasId: string, patch: Partial<FigureSpec> = {}): FigureSpec => ({
  canvasId,
  frameId: null,
  view: "canvas",
  rows: "canvas",
  lines: { rel: true, map: true, src: true, cube: true },
  status: true,
  ...patch,
});
function drawn(input: FigureInput, spec: FigureSpec) {
  const d = figureDrawing(input, spec);
  if (d.kind !== "drawn") throw new Error(`not drawn: ${d.kind}`);
  return d;
}
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;

describe("a figure of a canvas (slice 27)", () => {
  it("draws every card at the canvas's place and height, from the canvas's own card rule", () => {
    const db = demo();
    const canvas = canvasNamed(db, "Customer & orders");
    const input = inputOf(db);
    const d = drawn(input, asCanvas(canvas.id));
    const items = db.canvas_item.filter((i) => i.canvas_id === canvas.id && i.deleted_at === null && (i.entity_id || i.source_table_id));
    const cards = buildCards(input.snapshot.model, items);
    expect(d.cards).toBe(cards.length);
    for (const c of cards) {
      // the card's rectangle as the canvas draws it is among the figure's drawn rectangles
      expect(d.rects).toContainEqual({ x: c.x, y: c.y, w: cardWidth(c), h: cardHeight(c) });
      expect(d.svg).toContain(`<g transform="translate(${c.x},${c.y})">`);
    }
    // the box is what is drawn and 20 px around it
    const minX = Math.min(...d.rects.map((r) => r.x)), minY = Math.min(...d.rects.map((r) => r.y));
    expect(d.box.x).toBe(Math.floor(minX - 20));
    expect(d.box.y).toBe(Math.floor(minY - 20));
    expect(d.svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${d.box.x} ${d.box.y} ${d.box.w} ${d.box.h}"`)).toBe(true);
  });

  it("draws relationships with their pills, mappings with their status and chips, source keys and a requirement card with its traces (D2)", () => {
    const db = demo();
    const d = drawn(inputOf(db), asCanvas(canvasNamed(db, "Customer & orders").id));
    expect(d.svg).toContain(`<g class="rel">`);
    expect(d.svg).toContain(">places</text>");
    expect(count(d.svg, /<g class="map approved/g)).toBeGreaterThan(0);
    expect(d.svg).toMatch(/<g class="map (review|draft)/);
    expect(d.svg).toContain(`<g class="srel`);
    expect(d.svg).toContain(">REQ-104</text>");
    expect(count(d.svg, /class="trace"/g)).toBeGreaterThan(0);
  });

  it("never draws notes or label marks (C4)", () => {
    const db = demo();
    const canvas = canvasNamed(db, "Customer & orders");
    const notes = db.note.filter((x) => x.canvas_id === canvas.id && x.deleted_at === null);
    expect(notes.length).toBeGreaterThan(0);
    const d = drawn(inputOf(db), asCanvas(canvas.id));
    for (const x of notes) expect(d.svg).not.toContain((x.body_text ?? "").slice(0, 20) || "0000");
    expect(d.svg).not.toContain("foreignObject");
    for (const l of db.label.filter((x) => x.workspace_id === WS)) expect(d.svg).not.toContain(`>${l.name}<`);
  });

  it("Adjusted: the row choice, the line kinds and the status marks; never a requirement card", () => {
    const db = demo();
    const canvas = canvasNamed(db, "Customer & orders");
    const input = inputOf(db);
    const all = drawn(input, asCanvas(canvas.id, { view: "custom", rows: "all" }));
    const keys = drawn(input, asCanvas(canvas.id, { view: "custom", rows: "keys" }));
    const none = drawn(input, asCanvas(canvas.id, { view: "custom", rows: "none" }));
    // a row is drawn as a name text at x 36 or 52
    const rows = (svg: string) => count(svg, /<text x="(36|52)" y="[\d.]+" font-size="12(\.5)?"/g);
    expect(rows(all.svg)).toBeGreaterThan(rows(keys.svg));
    expect(rows(keys.svg)).toBeGreaterThan(0);
    expect(rows(none.svg)).toBe(0);
    expect(all.svg).not.toContain(">REQ-104</text>");
    const bare = drawn(input, asCanvas(canvas.id, { view: "custom", lines: { rel: false, map: false, src: false, cube: false }, status: false }));
    expect(bare.svg).not.toContain(`<g class="rel">`);
    expect(bare.svg).not.toContain(`<g class="map`);
    expect(bare.svg).not.toContain(`<g class="srel`);
    // no status marks: no dots, no counts in the header
    expect(bare.svg).not.toMatch(/<circle cx="[\d.]+" cy="[\d.]+" r="5"/);
    expect(bare.svg).not.toMatch(/text-anchor="end" fill="#7C8998">\d+\/\d+</);
  });

  it("follows the canvas's hidden relationship kinds as on the canvas (D6), and draws dimensional lines only while that level is drawn (D7)", () => {
    const db = demo((x) => {
      const c = x.canvas.find((k) => k.name === "Customer & orders")!;
      c.look = { ...c.look, hideEntityRelationships: true, layer: "mappings" };
    });
    const d = drawn(inputOf(db), asCanvas(canvasNamed(db, "Customer & orders").id));
    expect(d.svg).not.toContain(`<g class="rel">`);
    // the layer switch is not followed: mappings and source keys stay
    expect(d.svg).toContain(`<g class="map`);
    const star = canvasNamed(db, "Sales star").id;
    expect(drawn(inputOf(db), asCanvas(star)).svg).toContain(`class="cmap`);
    expect(drawn(inputOf(db, {}, { dimensionalOn: false }), asCanvas(star)).svg).not.toContain(`class="cmap`);
  });

  it("leaves out what is outside the document's scope (D3), with its lines; says so when nothing is left", () => {
    const db = demo();
    const canvas = canvasNamed(db, "Customer & orders");
    const customer = db.entity.find((e) => e.name === "Customer" && e.workspace_id === WS)!;
    const input = inputOf(db);
    const without = inputOf(db, { entityIds: new Set([...input.scope.entityIds].filter((id) => id !== customer.id)) });
    expect(drawn(input, asCanvas(canvas.id)).svg).toContain(">Customer</text>");
    const d = drawn(without, asCanvas(canvas.id));
    expect(d.svg).not.toContain(">Customer</text>");
    expect(d.svg).not.toContain(">places</text>");
    expect(figureDrawing(inputOf(db, { entityIds: new Set(), tableIds: new Set() }), asCanvas(canvas.id))).toEqual({ kind: "empty" });
    // only approved mappings: no draft or review line
    expect(drawn(inputOf(db, { mappings: "approved" }), asCanvas(canvas.id)).svg).not.toMatch(/<g class="map (review|draft)/);
  });

  it("draws one frame with its cards only, its name above it; a gone canvas or frame says so (D11)", () => {
    const db = demo();
    const canvas = canvasNamed(db, "Customer & orders");
    const items = db.canvas_item.filter((i) => i.canvas_id === canvas.id && i.entity_id && i.deleted_at === null);
    const first = items[0]!;
    const frame: Frame = { ...first, id: sid(), canvas_id: canvas.id, name: "Party <core>", kind: "free", concept_id: null, source_system_id: null, color: "#3346C4", x: first.x - 40, y: first.y - 40, width: 400, height: 600, collapsed: true };
    db.frame.push(frame);
    first.frame_id = frame.id;
    const input = inputOf(db);
    const f = drawn(input, asCanvas(canvas.id, { frameId: frame.id }));
    expect(f.cards).toBe(1);
    expect(f.svg).toContain(">Party &lt;core&gt;</text>");
    // the whole canvas as on it: the frame is collapsed, a block with its kind and its one member
    const whole = drawn(input, asCanvas(canvas.id));
    expect(whole.svg).toContain(">Free area · collapsed</text>");
    expect(whole.cards).toBe(items.length + db.canvas_item.filter((i) => i.canvas_id === canvas.id && i.source_table_id && i.deleted_at === null).length - 1);
    expect(figureDrawing(input, asCanvas(canvas.id, { frameId: sid() }))).toEqual({ kind: "gone", what: "frame" });
    expect(figureDrawing(input, asCanvas(sid()))).toEqual({ kind: "gone", what: "canvas" });
  });

  it("escapes every text from the model and lists the faces it uses (Q2: Mono only with source tables)", () => {
    const db = demo((x) => {
      x.entity.find((e) => e.name === "Customer" && e.workspace_id === WS)!.name = `Customer <script>"&'`;
    });
    const d = drawn(inputOf(db), asCanvas(canvasNamed(db, "Customer & orders").id));
    expect(d.svg).toContain("Customer &lt;script&gt;&quot;&amp;&#39;");
    expect(d.svg).not.toContain("<script>");
    expect(d.faces).toEqual(expect.arrayContaining(["sans-400", "sans-600", "mono-400"]));
    const star = drawn(inputOf(db), asCanvas(canvasNamed(db, "Sales star").id));
    expect(star.faces).not.toContain("mono-500");
  });

  it("draws the words on a figure in the document's language (D11)", () => {
    const db = demo();
    const d = drawn(inputOf(db, {}, { words: { ...ENGLISH_FIGURE_WORDS, in: "w" } }), asCanvas(canvasNamed(db, "Customer & orders").id));
    expect(d.svg).toContain(">w Customer</text>");
  });

  it("is black and white in the style's black and white (F5)", () => {
    const db = demo();
    const d = drawn(inputOf(db, {}, { mono: true }), asCanvas(canvasNamed(db, "Customer & orders").id));
    expect(d.svg).not.toContain("#0B8A72");
    expect(d.svg).not.toContain("#C2410C");
  });
});

describe("the Figure section in a document (slice 27)", () => {
  function build(figures: unknown[], style = defaultStyle(), extra: { type: string; options: Record<string, unknown> }[] = []) {
    const db = demo();
    const state = documentStateFor(snapshotOf(db));
    return buildDocument({
      definition: {
        name: "Figures",
        author_id: SEED_IDS.userLukasz,
        scope: { projects: [], concepts: [], logical: true, dimensional: true, mappings: "all" },
        cover: { title: null, subtitle: null, version: null, status: null, preparedBy: null },
        style,
        sections: [
          ...extra.map((s) => ({ id: sid(), type: s.type, on: true, heading: null, newPage: true, options: s.options })),
          { id: sid(), type: "figure", on: true, heading: null, newPage: false, options: { figures } },
          { id: sid(), type: "figure", on: true, heading: null, newPage: false, options: { figures: figures.slice(0, 1) } },
        ],
      },
      state,
      types: DOCUMENT_SECTION_TYPES,
      date: "2026-11-14",
    });
  }
  const figuresOf = (nodes: readonly DocNode[]): DocFigure[] => nodes.flatMap((x) => (x.kind === "figure" ? [x.figure] : x.kind === "group" ? figuresOf(x.nodes) : []));

  it("draws its figures that are on, numbered in document order, with their captions and the editor's line (F6, F15)", () => {
    const db = demo();
    const co = canvasNamed(db, "Customer & orders").id, star = canvasNamed(db, "Sales star").id;
    const tree = build([
      { ...newFigure("f1", co), caption: "The orders" },
      newFigure("f2", star),
      { ...newFigure("f3", co), on: false },
    ]);
    const first = figuresOf(tree.sections[0]!.nodes), second = figuresOf(tree.sections[1]!.nodes);
    expect(first.map((f) => [f.number, f.caption])).toEqual([
      [1, "The orders"],
      [2, "Sales star"],
    ]);
    expect(second.map((f) => f.number)).toEqual([3]);
    expect(tree.figures.map((f) => [f.number, f.anchor, f.entryId])).toEqual([
      [1, "fg-1", "f1"],
      [2, "fg-2", "f2"],
      [3, "fg-3", "f1"],
    ]);
    expect(first[0]!.word).toBe("Figure");
    expect(first[0]!.summary).toMatch(/^1 figure · names [\d.]+ pt · (upright|turned on the page)/);
    expect(tree.sections[0]!.heading).toBe("Figures");
  });

  it("cuts a figure only in a size in parts, each part with its own region and words (Q4)", () => {
    const db = demo();
    const co = canvasNamed(db, "Customer & orders").id;
    for (const size of ["auto", "page"]) expect(figuresOf(build([{ ...newFigure("f", co), size }]).sections[0]!.nodes)[0]!.parts).toHaveLength(1);
    const parts = figuresOf(build([{ ...newFigure("f", co), size: "100" }]).sections[0]!.nodes)[0]!;
    expect(parts.parts.length).toBeGreaterThan(1);
    expect(parts.partTexts[0]).toBe(`part 1 of ${parts.parts.length}`);
    expect(new Set(parts.parts.map((p) => `${p.x},${p.y}`)).size).toBe(parts.parts.length);
    // turned on a portrait page when asked
    expect(figuresOf(build([{ ...newFigure("f", co), orientation: "landscape" }]).sections[0]!.nodes)[0]!.rot).toBe(true);
    expect(figuresOf(build([{ ...newFigure("f", co), orientation: "portrait" }]).sections[0]!.nodes)[0]!.rot).toBe(false);
  });

  it("shows the placeholder without a figure in the document, and the gone canvas's line (D11) in the document's language", () => {
    const tree = build([]);
    expect(tree.sections[0]!.nodes).toEqual([{ kind: "paragraph", runs: [{ text: "Add a figure in the panel on the right.", muted: true }], placeholder: true }]);
    const pl = build([newFigure("f", sid())], defaultStyle({ language: "pl" }));
    expect(pl.sections[0]!.nodes).toEqual([{ kind: "paragraph", runs: [{ text: "(kanwa już nie istnieje)", warn: true }] }]);
    expect(pl.sections[0]!.heading).toBe("Rysunki");
  });

  it("starts a new Figure entry on the same page (F7); the other types on a new page", () => {
    const db = demo();
    const ws = db.workspace.find((w) => w.id === WS)!;
    const sections = presetSections(presetOf("dictionary"), DOCUMENT_SECTION_KINDS.values(), ws, sid);
    expect(sections.every((s) => s.newPage)).toBe(true);
    expect(DOCUMENT_SECTION_KINDS.get("figure")!.samePage).toBe(true);
  });
});

describe("the recipe's figure fields (slice 27, F8)", () => {
  it("reads a stored figure with only its canvas with the prototype's defaults (FIG0)", () => {
    expect(figureEntry.parse({ id: "f", canvasId: "c" })).toEqual(newFigure("f", "c"));
  });

  it("refuses more than 50 figures and a figure listed twice", () => {
    const kind = DOCUMENT_SECTION_KINDS.get("figure")!;
    const many = Array.from({ length: 51 }, (_, i) => newFigure(`f${i}`, "c"));
    expect(kind.options.safeParse({ figures: many }).error?.issues[0]?.message).toBe("A section holds at most 50 figures.");
    expect(kind.options.safeParse({ figures: [newFigure("f", "c"), newFigure("f", "c")] }).success).toBe(false);
    expect(kind.options.safeParse({ figures: [{ ...newFigure("f", "c"), size: "90" }] }).success).toBe(false);
  });

  it("reads a recipe stored before slice 27 with the list of figures off and the smallest names at 6 pt", () => {
    const style = { ...defaultStyle() } as Record<string, unknown>;
    delete style.listOfFigures;
    delete style.smallestPt;
    const up = upgradeDocument({ id: "d", style, sections: [] })!;
    expect(up.style).toMatchObject({ listOfFigures: false, smallestPt: 6 });
    expect(upgradeDocument(up)).toBeNull();
  });
});
