// Slice 28 (item 2, Q5, Q-B, F3): the hints for options that show nothing, on the demo ("Retail Co – DWH"). The
// workspace's only mapping note is on a draft mapping (webusers.email → Customer.email), so the S2T document's filter
// "Approved and in review" leaves it out. The demo has no frames.

import { describe, expect, it } from "vitest";
import { DOCUMENT_TABLES, documentStateFor } from "@/compose/documents";
import { addFullDemoData } from "@/compose/seed";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import type { DevDb } from "@/data/local/schema";
import { workspaceSnapshotOf, type StoredRows } from "@/domain/model/workspace-model";
import type { Frame, ModuleTable } from "@/domain/types";
import { HINT_TEXTS, sectionHints, styleHints } from "@/modules/infodocumenter/domain/hints";
import { sectionScopeOf } from "@/modules/infodocumenter/domain/scope";
import type { DocumentScope, MappingFilter } from "@/modules/infodocumenter/domain/types";

const WS = SEED_IDS.wsRetailDwh;
const FRAME: Frame = {
  id: "",
  workspace_id: WS,
  canvas_id: "",
  name: "Concept",
  kind: "concept",
  concept_id: null,
  source_system_id: null,
  color: null,
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  collapsed: false,
  version: 1,
  created_at: "2026-11-16T00:00:00Z",
  created_by: SEED_IDS.userLukasz,
  updated_at: "2026-11-16T00:00:00Z",
  updated_by: SEED_IDS.userLukasz,
  deleted_at: null,
};

function demo(change?: (db: DevDb) => void): DevDb {
  const db = buildSeed();
  addFullDemoData(db);
  change?.(db);
  return db;
}
function hints(type: string, options: Record<string, unknown>, { db = demo(), mappings = "all", scope = {} }: { db?: DevDb; mappings?: MappingFilter; scope?: Partial<DocumentScope> } = {}) {
  const snapshot = workspaceSnapshotOf<ModuleTable>(db as unknown as StoredRows, WS, Object.fromEntries(DOCUMENT_TABLES.map((t) => [t, (db as unknown as Record<string, unknown[]>)[t] ?? []])) as never)!;
  const s = sectionScopeOf({ projects: [], concepts: [], logical: true, dimensional: true, mappings, ...scope }, snapshot);
  return sectionHints(documentStateFor(snapshot), s, type, options);
}
const live = <T extends { workspace_id: string; deleted_at: string | null }>(rows: T[]) => rows.filter((r) => r.workspace_id === WS && !r.deleted_at);
const notes = (db: DevDb) => live(db.mapping).filter((m) => m.note_text?.trim());

describe("Source-to-target's Note (item 2, F3)", () => {
  it("the demo's note is on a draft: hidden by 'Approved and in review', shown with 'All'; one note reads in the singular", () => {
    const db = demo();
    expect(notes(db).map((m) => m.status)).toEqual(["draft"]);
    expect(hints("s2t", { columns: ["target", "note"] }, { db, mappings: "notdraft" })).toEqual({ columns: "1 note is on a mapping that Mappings included leaves out." });
    expect(hints("s2t", { columns: ["target", "note"] }, { db, mappings: "all" })).toEqual({});
  });
  it("under 'Approved only' notes on mappings in review are left out too (F3); several in the plural", () => {
    const db = demo((d) => {
      const review = live(d.mapping).find((m) => m.status === "review" && !m.note_text)!;
      review.note_text = "Check the rounding.";
    });
    // shown under "Approved and in review": no hint
    expect(hints("s2t", { columns: ["note"] }, { db, mappings: "notdraft" })).toEqual({});
    expect(hints("s2t", { columns: ["note"] }, { db, mappings: "approved" })).toEqual({ columns: "2 notes are on mappings that Mappings included leaves out." });
  });
  it("no note at all says so; Note unticked gives no hint", () => {
    const none = demo((db) => notes(db).forEach((m) => (m.note_text = null)));
    expect(hints("s2t", { columns: ["note"] }, { db: none, mappings: "all" }).columns).toBe("No mapping in this document has a note.");
    expect(hints("s2t", { columns: ["target", "rule"] }, { mappings: "notdraft" })).toEqual({});
  });
  it("an approved mapping's note in scope gives no hint", () => {
    const db = demo((d) => (notes(d)[0]!.status = "approved"));
    expect(hints("s2t", { columns: ["note"] }, { db, mappings: "approved" })).toEqual({});
  });
});

describe("Source tables, the dictionary and the style (Q-B)", () => {
  it("a table note and a table classification: a hint only while ticked and no table in scope has one", () => {
    const bare = demo((db) => {
      for (const x of live(db.source_table)) x.note_text = null;
      db.classification_link = db.classification_link.filter((l) => !l.source_table_id);
    });
    expect(hints("sources", { tableNote: true, tableClassifications: true, columns: [] }, { db: bare })).toEqual({
      tableNote: HINT_TEXTS.noTableNote,
      tableClassifications: HINT_TEXTS.noTableClassification,
    });
    expect(hints("sources", { tableNote: false, tableClassifications: false, columns: [] }, { db: bare })).toEqual({});
    const noted = demo((db) => (live(db.source_table)[0]!.note_text = "Loaded nightly."));
    expect(hints("sources", { tableNote: true, columns: [] }, { db: noted }).tableNote).toBeUndefined();
  });
  it("the concept's frame: a hint when no canvas in scope has a frame for a concept the dictionary shows", () => {
    const bare = demo();
    expect(live(bare.frame)).toEqual([]);
    expect(hints("dict", { byConcept: true, conceptFigures: true }, { db: bare })).toEqual({ conceptFigures: HINT_TEXTS.noConceptFrame });
    expect(hints("dict", { byConcept: false, conceptFigures: true }, { db: bare })).toEqual({});
    const framed = demo((db) => {
      const entity = live(db.entity).find((e) => e.model_level === "logical")!;
      const canvas = live(db.canvas)[0]!;
      db.frame.push({ ...structuredClone(FRAME), id: "00000000-0000-7000-8000-000000002801", workspace_id: WS, canvas_id: canvas.id, kind: "concept", concept_id: entity.concept_id });
    });
    expect(hints("dict", { byConcept: true, conceptFigures: true }, { db: framed })).toEqual({});
  });
  it("the List of figures: a hint only while on and the document has no figure", () => {
    expect(styleHints(true, 0)).toEqual({ listOfFigures: HINT_TEXTS.noFigures });
    expect(styleHints(true, 3)).toEqual({});
    expect(styleHints(false, 0)).toEqual({});
  });
});
