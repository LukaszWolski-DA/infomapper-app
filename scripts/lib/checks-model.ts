// The model checks of one workspace of a local data file, as the pages build them (slice 20): the model as
// `store.model.load` gives it, InfoCube's rows, the requirement feeds and the lookup. For the bench and the read-only
// count; reads the object it is given and writes nothing.

import { cubeModuleChecks } from "../../src/compose/checks";
import type { DevDb } from "../../src/data/local/schema";
import type { InfoCubeDb } from "../../src/modules/infocube/data/tables";
import { cubeRequirementFeeds, mappingIndex } from "../../src/modules/infocube/domain/mappings";
import { cubePageRows } from "../../src/modules/infocube/domain/view";
import { checkIndex, lineOf, modelChecks, type CheckInput, type CheckLine, type ModelChecks } from "../../src/domain/model/checks";
import { cubeIndex, type CubeIndex } from "../../src/modules/infocube/domain/keys";
import { lookupModel, type ModelLookup } from "../../src/domain/model/requirements";
import type { Uuid } from "../../src/domain/ids";
import type { WorkspaceModel } from "../../src/domain/types";

export type ChecksDb = DevDb & Partial<InfoCubeDb>;

const of = <T extends { deleted_at: string | null; workspace_id: string }>(rows: readonly T[] | undefined, ws: Uuid) => (rows ?? []).filter((r) => r.deleted_at === null && r.workspace_id === ws);

export function modelOf(db: ChecksDb, ws: Uuid): WorkspaceModel {
  const all = db.attribute.filter((a) => a.workspace_id === ws);
  const byId = new Map(all.map((a) => [a.id, a]));
  const lost = [...new Set(of(all, ws).flatMap((a) => (a.copied_from_attribute_id && byId.get(a.copied_from_attribute_id)?.deleted_at !== null ? [a.copied_from_attribute_id] : [])))];
  return {
    concepts: of(db.concept, ws),
    entities: of(db.entity, ws).sort((a, b) => a.name.localeCompare(b.name)),
    attributes: of(all, ws).sort((a, b) => a.entity_id.localeCompare(b.entity_id) || a.sort_order - b.sort_order),
    relationships: of(db.relationship, ws),
    sourceSystems: of(db.source_system, ws),
    sourceTables: of(db.source_table, ws),
    sourceColumns: of(db.source_column, ws),
    mappings: of(db.mapping, ws),
    mappingInputs: of(db.mapping_input, ws),
    attributeInputs: of(db.attribute_input ?? [], ws),
    sourceRelationships: [],
    sourceRelationshipColumns: [],
    classifications: [],
    classificationLinks: [],
    lostOriginals: lost.flatMap((id) => {
      const a = byId.get(id);
      return a ? [{ id, name: a.name, entityName: db.entity.find((e) => e.id === a.entity_id)?.name ?? "?" }] : [];
    }),
  };
}

export interface Prepared {
  model: WorkspaceModel;
  lookup: ModelLookup;
  rows: ReturnType<typeof cubePageRows>;
  on: boolean;
  /** The page's cube index (its sections build one), passed to InfoCube's rules. */
  cube: CubeIndex;
}

/** What a page has before the checks: the model, the module's rows and the requirement index's lookup. */
export function prepare(db: ChecksDb, ws: Uuid): Prepared {
  const model = modelOf(db, ws);
  const rows = cubePageRows(of(db.cube_entity, ws), of(db.cube_measure, ws), of(db.cube_key, ws), of(db.cube_mapping, ws), of(db.cube_mapping_input, ws), of(db.cube_attribute, ws));
  const feeds = cubeRequirementFeeds(mappingIndex({ entities: model.entities, attributes: model.attributes, cubeMappings: rows.cubeMappings as never, cubeMappingInputs: rows.cubeMappingInputs as never }), model.attributes);
  return { model, lookup: lookupModel(model, feeds), rows, on: !!db.workspace.find((w) => w.id === ws)?.infocube, cube: cubeOf(model, rows) };
}

export const cubeOf = (model: WorkspaceModel, rows: ReturnType<typeof cubePageRows>): CubeIndex =>
  cubeIndex({ entities: model.entities, attributes: model.attributes, relationships: model.relationships, cubeEntities: rows.cubeEntities as never, cubeMeasures: rows.cubeMeasures as never, cubeKeys: rows.cubeKeys as never });

/** What a canvas page computes after a write: the checks' items, the marks and one canvas's count (no texts). */
export function marksOf(p: Prepared, canvasEntities: ReadonlySet<Uuid>) {
  const input: CheckInput = { model: p.model, lookup: p.lookup, scope: null };
  const checks = modelChecks(input, cubeModuleChecks(p.on, p.rows, input, p.cube));
  const index = checkIndex(checks, (id) => p.lookup.attribute.get(id)?.entity_id);
  return { checks, index, canvas: index.countOn(canvasEntities) };
}

/** What the project home computes: its scope's items and every line's words. */
export function homeOf(p: Prepared, scope: ReadonlySet<Uuid> | null): { checks: ModelChecks; lines: CheckLine[] } {
  const input: CheckInput = { model: p.model, lookup: p.lookup, scope };
  const checks = modelChecks(input, cubeModuleChecks(p.on, p.rows, input, p.cube));
  return { checks, lines: checks.groups.flatMap((g) => g.items.map(lineOf)) };
}
