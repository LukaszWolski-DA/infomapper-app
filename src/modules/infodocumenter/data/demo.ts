// InfoDocumenter's demo (slice 25, F31, F32): the organization's licence, the switch on in the workspace, and three
// documents from the live model, made from the presets as New document makes them: a shared data dictionary by Łukasz,
// his private source-to-target specification for Order management (ending with InfoCube's Dimensional model while
// InfoCube is on), and Anna's private working dictionary. Run after the rest of the demo (`addDocumentsDemoData`), never
// inside `addFullDemoData`, so earlier fixtures and benches read the demo as before. False when it ran already.

import type { DevDb } from "@/data/local/schema";
import { seedId } from "@/data/local/seed-model";
import type { DocumentSectionKind } from "@/domain/document/sections";
import type { Uuid } from "@/domain/ids";
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
