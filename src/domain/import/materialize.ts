// The model as an import leaves it (slice 7b, Q3; slice 7a's test fixture moved here): the changeset applied in memory,
// new rows at version 1 and patched rows one version up, as the command writes them. The review works out coverage
// after the import from it, and the tests read it.

import type { Uuid } from "../ids";
import type { ClassificationLink, SourceChange, SourceSystem, Timestamp } from "../types";
import type { ImportChangeset } from "./apply";
import type { ImportColumn, ImportModel, ImportRelationship, ImportTable } from "./model";

export interface MaterializeContext {
  workspaceId: Uuid;
  actorId: Uuid;
  now: Timestamp;
}

export function materialize(model: ImportModel, c: ImportChangeset, ctx: MaterializeContext): ImportModel {
  const standard = (id: Uuid) => ({
    id,
    workspace_id: ctx.workspaceId,
    version: 1,
    created_at: ctx.now,
    created_by: ctx.actorId,
    updated_at: ctx.now,
    updated_by: ctx.actorId,
    deleted_at: null,
  });
  const patch = <R extends { id: string; version: number }>(rows: readonly R[], patches: readonly { id: string; patch: Partial<R> }[]): R[] => {
    if (!patches.length) return [...rows];
    const byId = new Map(patches.map((p) => [p.id, p.patch]));
    return rows.map((r) => (byId.has(r.id) ? { ...r, ...byId.get(r.id), version: r.version + 1 } : r));
  };
  const systems: SourceSystem[] = c.system.isNew ? [...model.systems, { ...standard(c.system.id), name: c.system.name, description: null }] : [...model.systems];
  const tables: ImportTable[] = [
    ...patch(model.tables, c.tables.update),
    ...c.tables.insert.map((t) => ({ ...standard(t.id), ...t, missing_since: null, retired_since: null, note_html: null, note_text: null })),
  ];
  const columns: ImportColumn[] = [
    ...patch(model.columns, c.columns.update),
    ...c.columns.insert.map((x) => ({ ...standard(x.id), ...x, default_value: null, missing_since: null, retired_since: null, not_needed: false, note_html: null, note_text: null })),
  ];
  const removed = new Set(c.relationshipColumns.remove);
  const pairsOf = (relationshipId: string) =>
    c.relationshipColumns.insert
      .filter((p) => p.source_relationship_id === relationshipId)
      .map((p) => ({ id: p.id, from_column_id: p.from_column_id, to_column_id: p.to_column_id, sort_order: p.sort_order }));
  const relationships: ImportRelationship[] = [
    ...patch<ImportRelationship>(model.relationships, c.relationships.update as { id: string; patch: Partial<ImportRelationship> }[]).map((r) => ({
      ...r,
      columns: [...r.columns.filter((p) => !removed.has(p.id)), ...pairsOf(r.id)],
    })),
    ...c.relationships.insert.map((r) => ({
      id: r.id,
      version: 1,
      deleted_at: null,
      source_table_id: r.source_table_id,
      to_source_table_id: r.to_source_table_id,
      name: r.name,
      missing_since: null,
      columns: pairsOf(r.id),
    })),
  ];
  const changes: SourceChange[] = [
    ...patch(model.changes ?? [], c.changes.update),
    ...c.changes.insert.map((x) => ({ ...standard(x.id), ...x, status: "open" as const, resolution: null, resolved_by: null, resolved_at: null })),
  ];
  const classificationLinks: ClassificationLink[] = [
    ...(model.classificationLinks ?? []),
    ...c.classificationLinks.insert.map((l) => ({ ...standard(l.id), ...l, source_table_id: null })),
  ];
  return { ...model, systems, tables, columns, relationships, mappings: patch(model.mappings, c.mappings), changes, classificationLinks };
}
