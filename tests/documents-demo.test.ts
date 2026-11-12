// InfoDocumenter's demo (slice 25, F31, F32, step 4b): the licence, the switch, three documents, and twelve attribute
// definitions written by the documents' demo layer only; `addFullDemoData` (every earlier fixture's) is untouched.

import { describe, expect, it } from "vitest";
import { addDocumentsDemoData, addFullDemoData } from "@/compose/seed";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import { DEMO_ATTRIBUTE_DEFINITIONS, DEMO_DOCUMENT_NAMES } from "@/modules/infodocumenter/data/demo";
import type { DocumentDefinition } from "@/modules/infodocumenter/domain/types";

const WS = SEED_IDS.wsRetailDwh;
const definitionOf = (db: ReturnType<typeof buildSeed>, entity: string, attribute: string) => {
  const e = db.entity.find((x) => x.workspace_id === WS && x.name === entity && x.model_level === "logical")!;
  return db.attribute.find((a) => a.entity_id === e.id && a.name === attribute)!.definition_text;
};

describe("the documents' demo", () => {
  it("writes the licence, the switch, three documents and the twelve definitions, once", () => {
    const db = buildSeed();
    addFullDemoData(db);
    for (const [e, a] of DEMO_ATTRIBUTE_DEFINITIONS) expect(definitionOf(db, e, a), `${e}.${a}`).toBeNull();
    expect(addDocumentsDemoData(db)).toBe(true);
    expect(DEMO_ATTRIBUTE_DEFINITIONS).toHaveLength(12);
    for (const [e, a, text] of DEMO_ATTRIBUTE_DEFINITIONS) expect(definitionOf(db, e, a), `${e}.${a}`).toBe(text);
    expect(db.workspace.find((w) => w.id === WS)!.infodoc).toBe(true);
    expect(db.organization_licence.filter((l) => l.module === "infodoc" && l.organization_id === SEED_IDS.orgInfoMate)).toHaveLength(1);
    const docs = (db as unknown as { document_definition: DocumentDefinition[] }).document_definition;
    expect(docs.map((d) => [d.name, d.shared])).toEqual([
      [DEMO_DOCUMENT_NAMES.shared, true],
      [DEMO_DOCUMENT_NAMES.s2t, false],
      [DEMO_DOCUMENT_NAMES.anna, false],
    ]);
    expect(addDocumentsDemoData(db)).toBe(false);
  });

  it("leaves the full demo every earlier fixture reads without definitions", () => {
    const db = buildSeed();
    addFullDemoData(db);
    const ids = new Set(db.entity.filter((e) => e.workspace_id === WS).map((e) => e.id));
    expect(db.attribute.filter((a) => ids.has(a.entity_id) && a.definition_text)).toEqual([]);
  });
});
