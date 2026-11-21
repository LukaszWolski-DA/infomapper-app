// Slice 34's test documents (Q7): the demo's three documents and documents made of every section type, built as the
// editor builds them (`buildDocument` over the snapshot's state), and their Markdown. Shared by the Markdown's unit
// tests and the HTML-unchanged test.

import { DOCUMENT_SECTION_TYPES, DOCUMENT_TABLES, documentStateFor } from "@/compose/documents";
import { addSeedDemoData } from "@/compose/seed";
import type { DevDb } from "@/data/local/schema";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import { newFigure, type FigureEntry } from "@/domain/document/figure-entry";
import { workspaceSnapshotOf, type StoredRows } from "@/domain/model/workspace-model";
import type { DocLanguage, ModuleTable } from "@/domain/types";
import { buildDocument, type DocumentTree } from "@/modules/infodocumenter/domain/document";
import { documentMarkdown } from "@/modules/infodocumenter/domain/markdown";
import { DICTIONARY_COLUMNS, DICTIONARY_ENTITY_FIELDS, INFODOC_SECTION_KINDS, QUALITY_COLUMNS, REQUIREMENT_COLUMNS, S2T_COLUMNS } from "@/modules/infodocumenter/domain/sections";
import { defaultStyle } from "@/modules/infodocumenter/domain/style";
import type { DocumentDefinition, DocumentStyle } from "@/modules/infodocumenter/domain/types";

export const WS = SEED_IDS.wsRetailDwh;
export const GENERATED = "2026-11-21T09:05+01:00";
export const DATE = "2026-11-21";

/** The demo as the seed writes it: the star, its derivations and checks, InfoDocumenter's three documents. */
export function demoDb(change?: (db: DevDb) => void): DevDb {
  const db = buildSeed(new Date("2026-11-21T08:00:00Z"));
  addSeedDemoData(db, "2026-11-21T08:00:00.000Z");
  change?.(db);
  return db;
}

export const snapshotOf = (db: DevDb) =>
  workspaceSnapshotOf<ModuleTable>(db as unknown as StoredRows, WS, Object.fromEntries(DOCUMENT_TABLES.map((t) => [t, (db as unknown as Record<string, unknown[]>)[t] ?? []])) as never)!;

export const demoDocuments = (db: DevDb): DocumentDefinition[] => (db as unknown as { document_definition: DocumentDefinition[] }).document_definition.filter((d) => d.deleted_at === null);

export function treeOf(definition: Pick<DocumentDefinition, "name" | "author_id" | "scope" | "cover" | "sections" | "style">, db: DevDb): DocumentTree {
  return buildDocument({ definition, state: documentStateFor(snapshotOf(db)), types: DOCUMENT_SECTION_TYPES, date: DATE });
}

export const markdownOf = (definition: Pick<DocumentDefinition, "name" | "author_id" | "scope" | "cover" | "sections" | "style">, db: DevDb) =>
  documentMarkdown({ tree: treeOf(definition, db), name: definition.name, generated: GENERATED });

let n = 0;
const sid = () => `00000000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
const defaults = (type: string) => (INFODOC_SECTION_KINDS.find((k) => k.type === type) ?? DOCUMENT_SECTION_TYPES.get(type)!).defaults();

/** A document of the given sections over each type's defaults, in the demo's workspace. */
export function documentOf(
  sections: readonly { type: string; options?: Record<string, unknown>; heading?: string }[],
  o: { name?: string; language?: DocLanguage | null; style?: Partial<DocumentStyle>; mappings?: "approved" | "notdraft" | "all"; cover?: Partial<DocumentDefinition["cover"]> } = {},
): Pick<DocumentDefinition, "name" | "author_id" | "scope" | "cover" | "sections" | "style"> {
  return {
    name: o.name ?? "Every section",
    author_id: SEED_IDS.userLukasz,
    scope: { projects: [], concepts: [], logical: true, dimensional: true, mappings: o.mappings ?? "all" },
    cover: { title: null, subtitle: null, version: null, status: null, preparedBy: null, ...o.cover },
    style: { ...defaultStyle({ language: o.language ?? null }), ...o.style },
    sections: sections.map((s) => ({ id: sid(), type: s.type, on: true, heading: s.heading ?? null, newPage: true, options: { ...defaults(s.type), ...s.options } })),
  };
}

/** Every section type (Q2), in the PDF's usual order. */
export const ALL_TYPES = ["text", "conv", "overview", "ready", "diagrams", "dict", "s2t", "reqs", "trace", "dq", "sources", "classreg", "figure", "cube.dim", "cube.bus"] as const;

/**
 * Every live canvas of the workspace and every frame on one, each as a figure "As on the canvas" with statuses (rule
 * 1's figures: each its own content; frames, mappings, dimensional mappings, requirement cards and source keys).
 */
export function everyFigure(db: DevDb): FigureEntry[] {
  const canvases = db.canvas.filter((c) => c.workspace_id === WS && c.deleted_at === null);
  return canvases.flatMap((c, i) => [
    newFigure(`c${i}`, c.id),
    ...db.frame.filter((f) => f.canvas_id === c.id && f.deleted_at === null).map((f, j) => newFigure(`c${i}f${j}`, c.id, f.id)),
  ]);
}

/** A document of every section type (Q2) with every figure, the dictionary in `layout`, long texts in `longTexts`. */
export function everySection(db: DevDb, o: { language?: DocLanguage | null; layout?: "below" | "column" | "cards"; longTexts?: "row" | "after" | "column"; requirements?: "list" | "table"; trace?: "byRequirement" | "matrix" } = {}) {
  const long = o.longTexts ?? "row";
  const options: Record<string, Record<string, unknown>> = {
    text: { body: "Scope of this stage: the *core* model.\nAssumptions: a_b_c stays_as_is; <b>no markup</b> | pipes & [links](x).\n\n# Not a heading\n- not a list" },
    conv: { naming: "Names in English; `snake_case` for attributes." },
    figure: { figures: everyFigure(db) },
    dict: { layout: o.layout ?? "below", columns: [...DICTIONARY_COLUMNS], entity: [...DICTIONARY_ENTITY_FIELDS] },
    s2t: { columns: [...S2T_COLUMNS], unmapped: true, longTexts: long },
    sources: { longTexts: long },
    dq: { columns: [...QUALITY_COLUMNS], longTexts: long },
    classreg: { classifications: ["PII", "BK"], longTexts: long },
    reqs: { layout: o.requirements ?? "list", columns: [...REQUIREMENT_COLUMNS], longTexts: long },
    trace: { layout: o.trace ?? "byRequirement" },
    "cube.dim": { dimensionDefinitions: true },
  };
  return documentOf(
    ALL_TYPES.map((type) => ({ type, options: options[type] })),
    { language: o.language ?? null, name: "Retail Co – stage 1 documentation", cover: { subtitle: "Stage 1 sign-off", version: "1.0", status: "Draft" } },
  );
}

const FRAME_A = "00000000-0000-7000-8000-00000000fa01";
const FRAME_B = "00000000-0000-7000-8000-00000000fa02";

/**
 * The demo with frames on "Customer & orders" (the demo has none): a concept frame, expanded, around Customer and Sales
 * Order; a free area, collapsed, around Order Line. And names the Mermaid rules must keep: Order Line as "Pozycja
 * zamówienia", its quantity as "ilość sztuk", a relationship's label with a quote.
 */
export function framedDb(): DevDb {
  return demoDb((d) => {
    const canvas = d.canvas.find((c) => c.workspace_id === WS && c.name === "Customer & orders")!;
    const entity = (name: string) => d.entity.find((e) => e.workspace_id === WS && e.name === name && e.model_level === "logical")!;
    const itemOf = (name: string) => d.canvas_item.find((i) => i.canvas_id === canvas.id && i.entity_id === entity(name).id && i.deleted_at === null)!;
    const customer = itemOf("Customer"), order = itemOf("Sales Order"), line = itemOf("Order Line");
    const base = { ...canvas, canvas_id: canvas.id, source_system_id: null, color: null };
    d.frame.push(
      { ...base, id: FRAME_A, name: "Party & orders", kind: "concept", concept_id: entity("Customer").concept_id, x: Math.min(customer.x, order.x) - 40, y: Math.min(customer.y, order.y) - 40, width: 900, height: 700, collapsed: false } as never,
      { ...base, id: FRAME_B, name: "Lines", kind: "free", concept_id: null, x: line.x - 40, y: line.y - 40, width: 400, height: 400, collapsed: true } as never,
    );
    customer.frame_id = FRAME_A;
    order.frame_id = FRAME_A;
    line.frame_id = FRAME_B;
    const orderLine = entity("Order Line");
    orderLine.name = "Pozycja zamówienia";
    d.attribute.find((a) => a.entity_id === orderLine.id && a.name === "quantity")!.name = "ilość sztuk";
    const places = d.relationship.find((r) => r.workspace_id === WS && r.label === "places")!;
    places.label = 'places "online"';
  });
}

/**
 * The sample's document (`docs/prd/slice-34-sample.md`, the prototype's "Retail Co – stage 1 documentation") on the
 * demo: its sections in its order, Diagrams with every canvas as on the canvas. The app has no "Changes since …" (a
 * baseline's section, later): left out.
 */
export function stageOneDocument(db: DevDb) {
  return documentOf(
    [
      { type: "text", options: { body: "Scope of this stage: …\n\nAssumptions: …\n\nOpen points: …" } },
      { type: "conv" },
      { type: "overview" },
      { type: "ready" },
      { type: "diagrams", options: { figures: everyFigure(db).filter((f) => !f.frameId) } },
      { type: "dict" },
      { type: "s2t" },
      { type: "reqs" },
      { type: "trace" },
      { type: "dq" },
      { type: "sources" },
      { type: "classreg" },
    ],
    { name: "Retail Co – stage 1 documentation" },
  );
}
