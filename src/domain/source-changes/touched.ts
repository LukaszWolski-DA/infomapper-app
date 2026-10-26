// What source changes touch (slice 7b, items 26–27; prototype `chgSet`): the Changes view lights it and fades the rest.
// Pure; the canvas turns it into a fade request (`ChangesDriver`), so nothing in the data or the layout changes (P11).
//   The objects of the selected changes (all open ones, or every change one import raised, open or resolved); for a
//   table kind every column of the table; for “All open changes” also every column missing from source and not retired,
//   and every mapping in review with a reason. Then every mapping that reads a touched column, with its attribute, its
//   inputs' columns and tables and its entity. Whole cards stay lit (F18): the lit set names entities, tables and
//   mappings, no rows.

import type { Uuid } from "../ids";
import type { Lit } from "../model/lit";
import type { SourceChange, WorkspaceModel } from "../types";
import { isOpen } from "./rules";

/** “All open changes”, or one import's id. */
export type ChangesSelection = "open" | Uuid;

export interface Touched {
  lit: Lit;
  tables: number;
  mappings: number;
  attributes: number;
}

export type TouchedModel = Pick<WorkspaceModel, "attributes" | "mappings" | "mappingInputs" | "sourceColumns" | "sourceTables">;

export function touchedBy(model: TouchedModel, changes: readonly SourceChange[], selection: ChangesSelection): Touched {
  const live = <R extends { deleted_at: string | null }>(rows: readonly R[]) => rows.filter((r) => r.deleted_at === null);
  const chosen = changes.filter((c) => c.deleted_at === null && (selection === "open" ? isOpen(c) : c.source_import_id === selection));
  const columns = live(model.sourceColumns);
  const tableOf = new Map(columns.map((c) => [c.id, c.source_table_id]));
  const cols = new Set<Uuid>(), tables = new Set<Uuid>(), maps = new Set<Uuid>();
  const tableKinds = new Set<Uuid>();
  for (const c of chosen) {
    if (c.source_column_id) cols.add(c.source_column_id);
    if (c.source_table_id) tables.add(c.source_table_id);
    if (c.mapping_id) maps.add(c.mapping_id);
    if ((c.kind === "table_left" || c.kind === "new_table") && c.source_table_id) tableKinds.add(c.source_table_id);
  }
  for (const c of columns) {
    if (tableKinds.has(c.source_table_id)) cols.add(c.id);
    if (selection === "open" && c.missing_since && !c.retired_since) cols.add(c.id);
  }
  const mappings = live(model.mappings);
  if (selection === "open") for (const m of mappings) if (m.status === "review" && m.review_reason) maps.add(m.id);

  const inputsOf = new Map<Uuid, Uuid[]>();
  for (const i of live(model.mappingInputs)) (inputsOf.get(i.mapping_id) ?? inputsOf.set(i.mapping_id, []).get(i.mapping_id)!).push(i.source_column_id);
  for (const m of mappings) if ((inputsOf.get(m.id) ?? []).some((id) => cols.has(id))) maps.add(m.id);

  const entityOf = new Map(live(model.attributes).map((a) => [a.id, a.entity_id]));
  const attributes = new Set<Uuid>(), entities = new Set<Uuid>(), litMaps = new Set<Uuid>();
  for (const m of mappings) {
    if (!maps.has(m.id)) continue;
    litMaps.add(m.id);
    attributes.add(m.attribute_id);
    const e = entityOf.get(m.attribute_id);
    if (e) entities.add(e);
    for (const id of inputsOf.get(m.id) ?? []) cols.add(id);
  }
  for (const id of cols) {
    const t = tableOf.get(id);
    if (t) tables.add(t);
  }
  // a table or column deleted since the change was raised is no longer on any canvas
  const liveTables = new Set(live(model.sourceTables).map((t) => t.id));
  for (const t of tables) if (!liveTables.has(t)) tables.delete(t);
  return {
    lit: { entities, tables, rows: new Map(), mappings: litMaps, relationships: new Set() },
    tables: tables.size,
    mappings: litMaps.size,
    attributes: attributes.size,
  };
}

/** A key that changes whenever the lit set does (`requestFade` compares keys only). */
export const touchedKey = (selection: ChangesSelection, t: Touched): string =>
  `changes:${selection}:${[...t.lit.tables].sort().join(",")}|${[...t.lit.entities].sort().join(",")}|${[...t.lit.mappings].sort().join(",")}`;
