// InfoDocumenter's demo (slice 25, F31, F32): the organization's licence, the switch on in the workspace, and three
// documents from the live model, made from the presets as New document makes them: a shared data dictionary by Łukasz,
// his private source-to-target specification for Order management (ending with InfoCube's Dimensional model while
// InfoCube is on), and Anna's private working dictionary. Step 4b: definitions for twelve logical attributes the
// documents print (the plain seed has none), written here, not in the seed's model, so no earlier spec reads them. Run
// after the rest of the demo (`addDocumentsDemoData`), never inside `addFullDemoData`, so earlier fixtures and benches
// read the demo as before. False when it ran already.

import type { DevDb } from "@/data/local/schema";
import { seedId } from "@/data/local/seed-model";
import type { DocumentSectionKind } from "@/domain/document/sections";
import type { Uuid } from "@/domain/ids";
import { plainTextPair } from "@/domain/model/plain-text";
import { presetOf, presetSections } from "../domain/presets";
import type { DocumentCover, DocumentDefinition, DocumentPreset, DocumentScope } from "../domain/types";

export interface DocumentsDemoTarget {
  workspaceId: Uuid;
  organizationId: Uuid;
  /** Łukasz, the shared dictionary's and the S2T's author. */
  ownerId: Uuid;
  /** Anna, the working dictionary's author. */
  modelerId: Uuid;
  /** Order management, the S2T's scope. */
  projectId: Uuid;
}

export const DEMO_DOCUMENT_NAMES = {
  shared: "Retail Co – data dictionary",
  s2t: "Order management – S2T for the ETL team",
  anna: "Anna's working dictionary",
} as const;

/** Step 4b: the demo's attribute definitions, by entity and attribute (logical entities of the workspace). */
export const DEMO_ATTRIBUTE_DEFINITIONS: readonly [entity: string, attribute: string, definition: string][] = [
  ["Customer", "customer_id", "The customer's number in the CRM; one per person or organisation."],
  ["Customer", "birth_date", "Date of birth as the customer gave it. Personal data: shown only to those who need it."],
  ["Customer", "segment_code", "The marketing segment, a three-letter code from the CRM's segment list."],
  ["Customer Address", "postal_code", "The postal code as written on the address, without spaces removed."],
  ["Sales Order", "order_number", "The number printed on the order confirmation; unique per order."],
  ["Sales Order", "order_date", "The day the customer placed the order, in the shop's time zone."],
  ["Sales Order", "total_amount", "The order's value after discounts, in the order's currency."],
  ["Sales Order", "status_code", "Where the order stands: open, shipped, delivered or cancelled."],
  ["Order Line", "quantity", "How many units of the product the customer ordered on this line."],
  ["Order Line", "discount_pct", "The discount on this line in per cent; zero when there is none."],
  ["Product", "sku", "The stock keeping unit, the product's code in the ERP."],
  ["Product", "list_price", "The price before any discount, in the shop's base currency."],
];

const EMPTY_COVER: DocumentCover = { title: null, subtitle: null, version: null, status: null, preparedBy: null };

export function addDocumentsDemo(db: DevDb & { document_definition?: DocumentDefinition[] }, t: DocumentsDemoTarget, kinds: Iterable<DocumentSectionKind>, at: string = new Date().toISOString()): boolean {
  const ws = t.workspaceId;
  const workspace = db.workspace.find((w) => w.id === ws);
  if (!workspace) return false;
  const id = (key: string) => seedId(ws, `infodoc:${key}`);
  const documents = (db.document_definition ??= []);
  if (documents.some((d) => d.id === id("document:shared"))) return false;

  if (!db.organization_licence.some((l) => l.organization_id === t.organizationId && l.module === "infodoc" && l.deleted_at === null)) {
    db.organization_licence.push({ id: id("licence"), version: 1, created_at: at, created_by: t.ownerId, updated_at: at, updated_by: t.ownerId, deleted_at: null, organization_id: t.organizationId, module: "infodoc" });
  }
  workspace.infodoc = true;

  // step 4b: the definitions, on attributes that have none yet
  for (const [entityName, attributeName, definition] of DEMO_ATTRIBUTE_DEFINITIONS) {
    const entity = db.entity.find((e) => e.workspace_id === ws && e.name === entityName && e.model_level === "logical" && e.deleted_at === null);
    const attribute = entity && db.attribute.find((a) => a.entity_id === entity.id && a.name === attributeName && a.deleted_at === null);
    if (!attribute || attribute.definition_text) continue;
    const text = plainTextPair(definition);
    attribute.definition_html = text.html;
    attribute.definition_text = text.text;
  }

  const list = [...kinds];
  const make = (key: string, preset: DocumentPreset, author: Uuid, row: { name: string; shared: boolean; scope?: Partial<DocumentScope>; cover?: Partial<DocumentCover> }): DocumentDefinition => {
    const p = presetOf(preset);
    let n = 0;
    return {
      id: id(`document:${key}`),
      workspace_id: ws,
      version: 1,
      created_at: at,
      created_by: author,
      updated_at: at,
      updated_by: author,
      deleted_at: null,
      name: row.name,
      author_id: author,
      shared: row.shared,
      audience: p.audience,
      preset,
      source_kind: "live",
      baseline_id: null,
      scope: { projects: [], concepts: [], logical: true, dimensional: true, mappings: p.mappings, ...row.scope },
      cover: { ...EMPTY_COVER, ...row.cover },
      sections: presetSections(p, list, workspace, () => id(`document:${key}:section:${n++}`)),
    };
  };
  documents.push(
    make("shared", "dictionary", t.ownerId, { name: DEMO_DOCUMENT_NAMES.shared, shared: true, cover: { subtitle: "For the business", version: "1.0", status: "Draft for review" } }),
    make("s2t", "s2t", t.ownerId, { name: DEMO_DOCUMENT_NAMES.s2t, shared: false, scope: { projects: [t.projectId] } }),
    make("anna", "dictionary", t.modelerId, { name: DEMO_DOCUMENT_NAMES.anna, shared: false, scope: { mappings: "all" } }),
  );
  return true;
}
