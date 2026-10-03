// Counts shown around the model (prototype renderStatus, insOverview, renderHome, renderWsHome, renderTabs): the status
// bar and the overview of a canvas, the project home, the workspace home and the canvas tabs. Pure TypeScript.

import type { Uuid } from "@/domain/ids";
import type { CanvasItem, Entity, WorkspaceModel } from "@/domain/types";
import { indexModel, typeCheckOf, type ModelIndex } from "./model-index";

const isMapped = (ix: ModelIndex, attributeId: Uuid) => (ix.mappingsOf.get(attributeId) ?? []).length > 0;

/** Mapping coverage of each entity on a canvas: its attributes and how many have a mapping. */
export function coverage(ix: ModelIndex, entityIds: readonly Uuid[]): { entity: Entity; attributes: number; mapped: number }[] {
  return entityIds
    .map((id) => ix.entity.get(id))
    .filter((e): e is Entity => !!e)
    .map((entity) => {
      const attributes = ix.attributesOf.get(entity.id) ?? [];
      return { entity, attributes: attributes.length, mapped: attributes.filter((a) => isMapped(ix, a.id)).length };
    });
}

export interface CanvasStatus {
  /** Attributes of the entities on this canvas, and how many of them are mapped. */
  attributes: number;
  mapped: number;
  /** In the whole model, as in the prototype. */
  mappings: number;
  drafts: number;
  typeProblems: number;
  relationships: number;
}

/** The status bar (prototype renderStatus): mapped attributes on this canvas; mappings, drafts, type problems and
 * relationships of the model. */
export function canvasStatus(ix: ModelIndex, entityIdsHere: readonly Uuid[]): CanvasStatus {
  const cov = coverage(ix, entityIdsHere);
  return {
    attributes: cov.reduce((n, c) => n + c.attributes, 0),
    mapped: cov.reduce((n, c) => n + c.mapped, 0),
    mappings: ix.model.mappings.length,
    drafts: ix.model.mappings.filter((m) => m.status === "draft").length,
    typeProblems: ix.model.mappings.filter((m) => !typeCheckOf(ix, m).ok).length,
    relationships: ix.model.relationships.length,
  };
}

export interface WorkspaceStats {
  entities: number;
  sourceTables: number;
  mappings: number;
  approved: number;
  typeProblems: number;
}

/** The workspace home's numbers (prototype renderWsHome). */
export function workspaceStats(model: WorkspaceModel): WorkspaceStats {
  const ix = indexModel(model);
  return {
    entities: model.entities.length,
    sourceTables: model.sourceTables.length,
    mappings: model.mappings.length,
    approved: model.mappings.filter((m) => m.status === "approved").length,
    typeProblems: model.mappings.filter((m) => !typeCheckOf(ix, m).ok).length,
  };
}

export interface ProjectStats {
  entities: number;
  sourceTables: number;
  attributes: number;
  mapped: number;
}

/** The project home's numbers (prototype renderHome): what is on the project's canvases. */
export function projectStats(model: WorkspaceModel, items: readonly CanvasItem[], projectCanvasIds: readonly Uuid[]): ProjectStats {
  const ix = indexModel(model);
  const canvases = new Set(projectCanvasIds);
  const entities = new Set<Uuid>(), tables = new Set<Uuid>();
  for (const i of items) {
    if (!canvases.has(i.canvas_id)) continue;
    if (i.entity_id && ix.entity.has(i.entity_id)) entities.add(i.entity_id);
    if (i.source_table_id && ix.table.has(i.source_table_id)) tables.add(i.source_table_id);
  }
  const cov = coverage(ix, [...entities]);
  return {
    entities: entities.size,
    sourceTables: tables.size,
    attributes: cov.reduce((n, c) => n + c.attributes, 0),
    mapped: cov.reduce((n, c) => n + c.mapped, 0),
  };
}

/** Cards per canvas (the number on each canvas tab and tile). */
export function cardsPerCanvas(items: readonly CanvasItem[]): Map<Uuid, number> {
  const n = new Map<Uuid, number>();
  for (const i of items) if (i.entity_id || i.source_table_id) n.set(i.canvas_id, (n.get(i.canvas_id) ?? 0) + 1);
  return n;
}
