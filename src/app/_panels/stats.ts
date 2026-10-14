// Counts shown around the model (prototype renderStatus, insOverview, renderHome, renderWsHome, renderTabs): the status
// bar and the overview of a canvas, the project home, the workspace home and the canvas tabs. Pure TypeScript.

import type { Uuid } from "@/domain/ids";
import type { RequirementIndex } from "@/domain/model/requirement-index";
import type { CanvasItem, Entity, Frame, Note, RequirementKind, RequirementStatus, WorkspaceModel } from "@/domain/types";
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

/** An open note on the project home (slice 3a, item 12): its text, its canvas, and what it is pinned to. */
export interface ProjectNote {
  id: Uuid;
  text: string;
  canvasId: Uuid;
  canvasName: string;
  /** The card's element or the frame it is pinned to, by name; null for a free note. */
  pinName: string | null;
}

/**
 * The open notes on a project's canvases (prototype renderHome): canvas by canvas in the project's tab order, each
 * canvas's notes in the order they were written.
 */
export function projectOpenNotes(
  notes: readonly Note[],
  canvases: readonly { id: Uuid; name: string }[],
  items: readonly CanvasItem[],
  frames: readonly Frame[],
  model: Pick<WorkspaceModel, "entities" | "sourceTables">,
): ProjectNote[] {
  const order = new Map(canvases.map((c, i) => [c.id, i]));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const frameName = new Map(frames.map((f) => [f.id, f.name]));
  const entityName = new Map(model.entities.map((e) => [e.id, e.name]));
  const tableName = new Map(model.sourceTables.map((t) => [t.id, t.name]));
  const pinName = (n: Note): string | null => {
    if (n.pin_frame_id) return frameName.get(n.pin_frame_id) ?? null;
    const card = n.pin_canvas_item_id ? itemById.get(n.pin_canvas_item_id) : undefined;
    if (!card) return null;
    return (card.entity_id ? entityName.get(card.entity_id) : card.source_table_id ? tableName.get(card.source_table_id) : undefined) ?? null;
  };
  return notes
    .filter((n) => n.deleted_at === null && n.status === "open" && order.has(n.canvas_id))
    .sort((a, b) => order.get(a.canvas_id)! - order.get(b.canvas_id)! || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .map((n) => ({ id: n.id, text: n.body_text ?? "", canvasId: n.canvas_id, canvasName: canvases[order.get(n.canvas_id)!]!.name, pinName: pinName(n) }));
}

/** A requirement on the project home (slice 4a, PRD item 30). */
export interface ProjectRequirement {
  id: Uuid;
  key: string;
  name: string;
  kind: RequirementKind;
  status: RequirementStatus;
  covered: number;
  total: number;
  done: boolean;
}

/**
 * The requirements on the project home (prototype projReqs, without requirement cards until slice 4b): every
 * requirement whose scope has an entity or a source table on one of the project's canvases, in the index's order.
 */
export function projectRequirements(index: RequirementIndex, items: readonly CanvasItem[], projectCanvasIds: readonly Uuid[]): ProjectRequirement[] {
  const canvases = new Set(projectCanvasIds);
  const here = new Set<Uuid>();
  for (const i of items) {
    if (i.deleted_at !== null || !canvases.has(i.canvas_id)) continue;
    if (i.entity_id) here.add(i.entity_id);
    if (i.source_table_id) here.add(i.source_table_id);
  }
  return index.requirements
    .filter((r) => {
      const scope = index.scope(r.id);
      return [...scope.entities].some((id) => here.has(id)) || [...scope.tables].some((id) => here.has(id));
    })
    .map((r) => {
      const c = index.coverage(r.id);
      return { id: r.id, key: r.key, name: r.name, kind: r.kind, status: r.status, covered: c.covered.length, total: c.total, done: c.done };
    });
}
