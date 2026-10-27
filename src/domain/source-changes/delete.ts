// Deleting a source table or column (slice 7b, item 13; step 1 answers Q4 and Q7; D-47): one cascade for the change's
// “Delete…” and the table panel's “Delete table”, and the impact its confirmation shows before anything happens.
//   - A mapping whose every input goes is deleted with its inputs and the label and requirement links on it; a mapping
//     that keeps other inputs loses only those inputs (D-49), and an approved one goes back to review (D-51) with the
//     reason “{column} was deleted from the model”.
//   - A source relationship with a column pair on a deleted column goes whole; a table's relationships go in both
//     directions (slice 7a).
//   - Label and requirement links on the table and its columns go; a table's cards go and notes pinned to them become
//     free notes at their place (slice 3a).
//   - Every open change on the deleted objects settles (P7, Q12): the change acted on reads “Deleted”, the others
//     “Settled: the column was deleted” (or table).
// Soft deletes only; the ids stay, so undo writes the rows back (AD-12, AD-13).

import { nextVersion, type CommandContext } from "../changes";
import { linksOnSources } from "../commands/classification";
import { linksOnItems, softDeleteLinks } from "../commands/label";
import { releaseNotes } from "../commands/note";
import { softDeleteRequirementLinks } from "../commands/requirement";
import { softDelete } from "../commands/shared";
import type { Uuid } from "../ids";
import { afterContentChange } from "../model/mapping-rules";
import type { ScopeModel } from "../model/requirements";
import type {
  Attribute,
  Canvas,
  CanvasItem,
  ClassificationLink,
  Entity,
  Frame,
  LabelLink,
  Mapping,
  MappingInput,
  MappingStatus,
  Note,
  Requirement,
  RequirementLink,
  SourceChange,
  SourceColumn,
  SourceRelationship,
  SourceRelationshipColumn,
  SourceTable,
} from "../types";
import { coverageDelta, type CoverageDelta } from "./coverage";
import { isOpen, settle, type Edit } from "./rules";
import { DELETED_INPUT_REASON, RESOLUTION, SETTLED } from "./texts";

/** The workspace's rows a delete reads; rows that are not live or not involved are ignored. */
export interface SourceDeleteRows {
  tables: readonly SourceTable[];
  columns: readonly SourceColumn[];
  mappings: readonly Mapping[];
  mappingInputs: readonly MappingInput[];
  attributes: readonly Attribute[];
  entities: readonly Entity[];
  relationships: readonly SourceRelationship[];
  relationshipColumns: readonly SourceRelationshipColumn[];
  canvasItems: readonly CanvasItem[];
  frames?: readonly Frame[];
  notes?: readonly Note[];
  labelLinks?: readonly LabelLink[];
  requirementLinks?: readonly RequirementLink[];
  /** Slice 7c (answer F18): the classification links on the table and its columns go with them. */
  classificationLinks?: readonly ClassificationLink[];
  changes?: readonly SourceChange[];
}

export type SourceDeleteTarget = { tableId: Uuid } | { columnId: Uuid };

export interface SourceDeleteCascade {
  table: SourceTable | null;
  columns: SourceColumn[];
  /** Mappings whose every input goes. */
  mappings: Mapping[];
  /** Mappings that keep other inputs, with the inputs they lose. */
  narrowed: { mapping: Mapping; inputs: MappingInput[] }[];
  /** The inputs of the deleted mappings. */
  inputs: MappingInput[];
  relationships: SourceRelationship[];
  relationshipColumns: SourceRelationshipColumn[];
  canvasItems: CanvasItem[];
  /** Open changes on the deleted table, columns and mappings. */
  changes: SourceChange[];
}

const live = <R extends { deleted_at: string | null }>(rows: readonly R[] | undefined): R[] => (rows ?? []).filter((r) => r.deleted_at === null);

/** Everything that goes with the table or column; null when the target is not live. */
export function sourceDeleteCascade(rows: SourceDeleteRows, target: SourceDeleteTarget): SourceDeleteCascade | null {
  let table: SourceTable | null = null;
  let columns: SourceColumn[];
  if ("tableId" in target) {
    table = live(rows.tables).find((t) => t.id === target.tableId) ?? null;
    if (!table) return null;
    columns = live(rows.columns).filter((c) => c.source_table_id === table!.id);
  } else {
    const column = live(rows.columns).find((c) => c.id === target.columnId);
    if (!column) return null;
    columns = [column];
  }
  const columnIds = new Set(columns.map((c) => c.id));

  const inputsByMapping = new Map<Uuid, MappingInput[]>();
  for (const i of live(rows.mappingInputs)) (inputsByMapping.get(i.mapping_id) ?? inputsByMapping.set(i.mapping_id, []).get(i.mapping_id)!).push(i);
  const mappings: Mapping[] = [];
  const narrowed: SourceDeleteCascade["narrowed"] = [];
  const inputs: MappingInput[] = [];
  for (const m of live(rows.mappings)) {
    const all = inputsByMapping.get(m.id) ?? [];
    const hit = all.filter((i) => columnIds.has(i.source_column_id));
    if (!hit.length) continue;
    if (hit.length === all.length) {
      mappings.push(m);
      inputs.push(...all);
    } else narrowed.push({ mapping: m, inputs: hit });
  }

  const pairs = live(rows.relationshipColumns);
  const relationships = live(rows.relationships).filter(
    (r) =>
      (table && (r.source_table_id === table.id || r.to_source_table_id === table.id)) ||
      pairs.some((p) => p.source_relationship_id === r.id && (columnIds.has(p.from_column_id) || columnIds.has(p.to_column_id))),
  );
  const relationshipIds = new Set(relationships.map((r) => r.id));
  const mappingIds = new Set(mappings.map((m) => m.id));
  const changes = (rows.changes ?? []).filter(
    (c) =>
      isOpen(c) &&
      ((table && c.source_table_id === table.id && !c.source_column_id && !c.mapping_id) ||
        (c.source_column_id !== null && columnIds.has(c.source_column_id)) ||
        (c.mapping_id !== null && mappingIds.has(c.mapping_id))),
  );
  return {
    table,
    columns,
    mappings,
    narrowed,
    inputs,
    relationships,
    relationshipColumns: pairs.filter((p) => relationshipIds.has(p.source_relationship_id)),
    canvasItems: table ? live(rows.canvasItems).filter((c) => c.source_table_id === table!.id) : [],
    changes,
  };
}

/** The rows the delete writes, in one change group; `actedOn` is the change whose “Delete…” this is. */
export function sourceDeleteEdits(ctx: CommandContext, rows: SourceDeleteRows, cascade: SourceDeleteCascade, actedOn: Uuid | null = null): Edit[] {
  const edits: Edit[] = [];
  const name = new Map(cascade.columns.map((c) => [c.id, c.name]));
  for (const { mapping, inputs } of cascade.narrowed) {
    const content = afterContentChange(mapping);
    const patch = mapping.status === "approved" ? { ...content.patch, review_reason: DELETED_INPUT_REASON(inputs.map((i) => name.get(i.source_column_id)!).join(", ")) } : content.patch;
    edits.push({ kind: "update", table: "mapping", before: mapping, row: nextVersion(ctx, mapping, patch) });
    edits.push(...inputs.map((i) => softDelete(ctx, "mapping_input", i)));
  }
  edits.push(...cascade.inputs.map((i) => softDelete(ctx, "mapping_input", i)));
  edits.push(...cascade.mappings.map((m) => softDelete(ctx, "mapping", m)));
  const mappingTargets = cascade.mappings.map((m) => ({ kind: "mapping" as const, id: m.id }));
  const sourceTargets = [...(cascade.table ? [{ kind: "source_table" as const, id: cascade.table.id }] : []), ...cascade.columns.map((c) => ({ kind: "source_column" as const, id: c.id }))];
  edits.push(...softDeleteLinks(ctx, linksOnItems(rows.labelLinks, [...mappingTargets, ...sourceTargets])));
  edits.push(...softDeleteRequirementLinks(ctx, rows.requirementLinks, [...mappingTargets, ...sourceTargets]));
  const goneTables = new Set(cascade.table ? [cascade.table.id] : []);
  edits.push(...linksOnSources(rows.classificationLinks, goneTables, new Set(cascade.columns.map((c) => c.id))).map((l) => softDelete(ctx, "classification_link", l)));
  edits.push(...cascade.relationshipColumns.map((p) => softDelete(ctx, "source_relationship_column", p)));
  edits.push(...cascade.relationships.map((r) => softDelete(ctx, "source_relationship", r)));
  edits.push(...cascade.canvasItems.map((c) => softDelete(ctx, "canvas_item", c)));
  edits.push(...releaseNotes(ctx, rows.notes, { items: rows.canvasItems, frames: rows.frames ?? [] }, { cardIds: cascade.canvasItems.map((c) => c.id) }));
  edits.push(...cascade.columns.map((c) => softDelete(ctx, "source_column", c)));
  if (cascade.table) edits.push(softDelete(ctx, "source_table", cascade.table));
  const ids = new Set(cascade.changes.map((c) => c.id));
  edits.push(...settle(ctx, cascade.changes, (c) => ids.has(c.id), (c) => (c.id === actedOn ? RESOLUTION.deleted : SETTLED.deleted(cascade.table ? "table" : "column"))));
  return edits;
}

export interface SourceDeleteImpact {
  what: "table" | "column";
  /** `dbo.customers` or `dbo.customers.email_addr`. */
  label: string;
  /** For a table: its columns. */
  columns: number;
  mappings: { id: Uuid; attribute: string; status: MappingStatus; effect: "deleted" | "loses this input" }[];
  relationships: { id: Uuid; name: string }[];
  /** Canvases the table's cards are on (a column's table keeps its cards). */
  canvases: { id: Uuid; name: string }[];
  /** Requirements whose coverage changes; empty: “No requirement’s coverage changes.” */
  coverage: CoverageDelta[];
}

/** What the confirmation lists before anything is deleted (D-47, item 13). */
export function sourceDeleteImpact(
  rows: SourceDeleteRows,
  cascade: SourceDeleteCascade,
  context: { canvases: readonly Canvas[]; requirements: readonly Requirement[]; requirementLinks: readonly RequirementLink[] },
): SourceDeleteImpact {
  const attributes = new Map(rows.attributes.map((a) => [a.id, a]));
  const entities = new Map(rows.entities.map((e) => [e.id, e]));
  const attributeLabel = (id: Uuid) => {
    const a = attributes.get(id);
    return a ? `${entities.get(a.entity_id)?.name ?? "?"}.${a.name}` : "?";
  };
  const tables = new Map(rows.tables.map((t) => [t.id, t]));
  const first = cascade.columns[0];
  const owner = cascade.table ?? (first ? tables.get(first.source_table_id) : undefined);
  const label = cascade.table ? `${cascade.table.schema_name}.${cascade.table.name}` : `${owner?.schema_name}.${owner?.name}.${first?.name}`;
  const canvasIds = new Set(cascade.canvasItems.map((c) => c.canvas_id));

  // the model after the delete, for coverage: what goes is gone, a narrowed approved mapping is in review
  const goneColumns = new Set(cascade.columns.map((c) => c.id));
  const goneMappings = new Set(cascade.mappings.map((m) => m.id));
  const goneInputs = new Set([...cascade.inputs, ...cascade.narrowed.flatMap((n) => n.inputs)].map((i) => i.id));
  const narrowedIds = new Set(cascade.narrowed.map((n) => n.mapping.id));
  const before: ScopeModel = {
    entities: [...rows.entities],
    attributes: [...rows.attributes],
    mappings: [...rows.mappings],
    mappingInputs: [...rows.mappingInputs],
    sourceTables: [...rows.tables],
    sourceColumns: [...rows.columns],
  };
  const after: ScopeModel = {
    ...before,
    mappings: rows.mappings.filter((m) => !goneMappings.has(m.id)).map((m) => (narrowedIds.has(m.id) && m.status === "approved" ? { ...m, status: "review" as const } : m)),
    mappingInputs: rows.mappingInputs.filter((i) => !goneInputs.has(i.id)),
    sourceTables: cascade.table ? rows.tables.filter((t) => t.id !== cascade.table!.id) : before.sourceTables,
    sourceColumns: rows.columns.filter((c) => !goneColumns.has(c.id)),
  };

  return {
    what: cascade.table ? "table" : "column",
    label,
    columns: cascade.table ? cascade.columns.length : 0,
    mappings: [
      ...cascade.mappings.map((m) => ({ id: m.id, attribute: attributeLabel(m.attribute_id), status: m.status, effect: "deleted" as const })),
      ...cascade.narrowed.map(({ mapping: m }) => ({ id: m.id, attribute: attributeLabel(m.attribute_id), status: m.status, effect: "loses this input" as const })),
    ],
    relationships: cascade.relationships.map((r) => ({ id: r.id, name: r.name })),
    canvases: live(context.canvases)
      .filter((c) => canvasIds.has(c.id))
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    coverage: coverageDelta(context.requirements, context.requirementLinks, before, after),
  };
}
