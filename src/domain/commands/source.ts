// Sources in slice 1a: “New source table” (a simple manual entry: system, database, schema, name, and the columns typed
// as lines), the column classification (BK, PII) and comment, and deleting a table no mapping reads from.
// Import of sources comes later.
// Slice 7c: the modeller's note on a table or column (`setSourceNote`, P8: plain text as a mapping's note, AD-17).
// Classifications are `commands/classification.ts`; `updateSourceColumn` goes with the column panel's flags in step 4.

import { z } from "zod";
import { fail, newRowColumns, nextVersion, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError } from "../errors";
import type { Uuid } from "../ids";
import { parseColumnLines } from "../model/column-lines";
import type { WorkspaceAccess } from "../permissions";
import {
  SOURCE_OBJECT_TYPES,
  type Attribute,
  type CanvasItem,
  type ClassificationLink,
  type Entity,
  type LabelLink,
  type RequirementLink,
  type Mapping,
  type MappingInput,
  type Note,
  type SourceColumn,
  type SourceRelationship,
  type SourceRelationshipColumn,
  type SourceSystem,
  type SourceTable,
} from "../types";
import { nameSchema, optionalTextSchema, uuidSchema, versionSchema } from "../validation";
import { sourceDeleteCascade, sourceDeleteEdits, type SourceDeleteRows } from "../source-changes/delete";
import { plainTextPair } from "../model/plain-text";
import { begin, current, done, isLive, nothingToChange, plainTextSchema } from "./shared";

const createSourceTableInput = z
  .object({
    systemName: nameSchema,
    databaseName: nameSchema,
    schemaName: nameSchema,
    name: nameSchema,
    objectType: z.enum(SOURCE_OBJECT_TYPES).optional(),
    columns: z.string().max(200_000, "Too many columns for one table."),
  })
  .strict();
export type CreateSourceTableInput = z.input<typeof createSourceTableInput>;

export interface CreateSourceTableState {
  /** Live source systems of the workspace. */
  systems: readonly SourceSystem[];
  /** Live source tables of the workspace (for the unique name per system, database and schema). */
  tables: readonly SourceTable[];
}

/**
 * Creates a source table with its columns. An existing system with the same name (ignoring case) is reused;
 * otherwise the system is created too. All in one change group.
 */
export function createSourceTable(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: CreateSourceTableState,
  input: unknown,
): CommandResult<{ sourceTableId: Uuid; sourceSystemId: Uuid; createdSystem: boolean }> {
  const parsed = begin(access, "model.edit", createSourceTableInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { systemName, databaseName, schemaName, name, objectType, columns: lines } = parsed.data;
  const workspaceId = access.workspace.id;
  const columns = parseColumnLines(lines);
  if (!columns.ok) return fail(columns.error);

  const writes: Write[] = [];
  let system = state.systems.find((s) => isLive(s, workspaceId) && s.name.toLocaleLowerCase() === systemName.toLocaleLowerCase());
  const createdSystem = !system;
  if (!system) {
    system = { ...newRowColumns(ctx), workspace_id: workspaceId, name: systemName, description: null };
    writes.push({ kind: "insert", table: "source_system", row: system });
  }
  const systemId = system.id;
  const taken = state.tables.some(
    (t) =>
      isLive(t, workspaceId) &&
      t.source_system_id === systemId &&
      t.database_name === databaseName &&
      t.schema_name === schemaName &&
      t.name === name,
  );
  if (taken) {
    return fail(domainError("conflict", `${system.name} / ${databaseName}.${schemaName}.${name} already exists.`, { name: "This table already exists." }));
  }

  const table: SourceTable = {
    ...newRowColumns(ctx),
    workspace_id: workspaceId,
    source_system_id: systemId,
    database_name: databaseName,
    schema_name: schemaName,
    name,
    object_type: objectType ?? "table",
    file_format: null,
    row_count: null,
    comment: null,
    missing_since: null,
    retired_since: null,
    note_html: null,
    note_text: null,
  };
  writes.push({ kind: "insert", table: "source_table", row: table });
  columns.columns.forEach((c, i) => {
    const column: SourceColumn = {
      ...newRowColumns(ctx),
      workspace_id: workspaceId,
      source_table_id: table.id,
      ...c,
      ordinal: i + 1,
      is_nullable: true,
      is_primary_key: false,
      is_foreign_key: false,
      is_business_key: false,
      is_pii: false,
      default_value: null,
      comment: null,
      missing_since: null,
      retired_since: null,
      not_needed: false,
      note_html: null,
      note_text: null,
    };
    writes.push({ kind: "insert", table: "source_column", row: column });
  });
  return done(ctx, access, { sourceTableId: table.id, sourceSystemId: systemId, createdSystem }, writes);
}

// ---- column classification and comment ----

const updateSourceColumnInput = z
  .object({
    sourceColumnId: uuidSchema,
    expectedVersion: versionSchema,
    isBusinessKey: z.boolean().optional(),
    isPii: z.boolean().optional(),
    comment: optionalTextSchema.optional(),
  })
  .strict();
export type UpdateSourceColumnInput = z.input<typeof updateSourceColumnInput>;

/** BK and PII flags and the comment. Name, type and position come from the source and stay as they are. */
export function updateSourceColumn(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { column: SourceColumn | null },
  input: unknown,
): CommandResult<{ column: SourceColumn }> {
  const parsed = begin(access, "model.edit", updateSourceColumnInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { sourceColumnId, expectedVersion, isBusinessKey, isPii, comment } = parsed.data;
  const got = current(state.column, access, sourceColumnId, expectedVersion, "source column");
  if (!got.ok) return fail(got.error);
  const before = got.row;
  const patch: Partial<SourceColumn> = {};
  if (isBusinessKey !== undefined && isBusinessKey !== before.is_business_key) patch.is_business_key = isBusinessKey;
  if (isPii !== undefined && isPii !== before.is_pii) patch.is_pii = isPii;
  if (comment !== undefined && comment !== before.comment) patch.comment = comment;
  if (Object.keys(patch).length === 0) return fail(nothingToChange());
  const row = nextVersion(ctx, before, patch);
  return done(ctx, access, { column: row }, [{ kind: "update", table: "source_column", before, row }]);
}

// ---- the modeller's note (slice 7c, P8, item 15) ----

const setSourceNoteInput = z
  .object({
    target: z.object({ kind: z.enum(["source_table", "source_column"]), id: uuidSchema }).strict(),
    expectedVersion: versionSchema,
    note: plainTextSchema,
  })
  .strict();
export type SetSourceNoteInput = z.input<typeof setSourceNoteInput>;

/** The toasts (item 15). */
export const NOTE_SAVED = (name: string) => `Note saved on ${name}`;
export const NOTE_REMOVED = (name: string) => `Note removed from ${name}`;

/**
 * A table's or column's note, saved as a mapping's note is (`plainTextPair`): the text as typed, its HTML escaped, so
 * markup is stored as text. An empty note clears it.
 */
export function setSourceNote(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: { table?: SourceTable | null; column?: SourceColumn | null },
  input: unknown,
): CommandResult<{ name: string; removed: boolean }> {
  const parsed = begin(access, "model.edit", setSourceNoteInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const { target, expectedVersion, note } = parsed.data;
  const { html, text } = plainTextPair(note);
  if (target.kind === "source_table") {
    const got = current(state.table, access, target.id, expectedVersion, "source table");
    if (!got.ok) return fail(got.error);
    if (text === got.row.note_text) return fail(nothingToChange());
    const row = nextVersion(ctx, got.row, { note_html: html, note_text: text });
    return done(ctx, access, { name: row.name, removed: text === null }, [{ kind: "update", table: "source_table", before: got.row, row }]);
  }
  const got = current(state.column, access, target.id, expectedVersion, "source column");
  if (!got.ok) return fail(got.error);
  if (text === got.row.note_text) return fail(nothingToChange());
  const row = nextVersion(ctx, got.row, { note_html: html, note_text: text });
  return done(ctx, access, { name: row.name, removed: text === null }, [{ kind: "update", table: "source_column", before: got.row, row }]);
}

// ---- delete a table ----

const deleteSourceTableInput = z.object({ sourceTableId: uuidSchema, expectedVersion: versionSchema }).strict();
export type DeleteSourceTableInput = z.input<typeof deleteSourceTableInput>;

export interface DeleteSourceTableState {
  table: SourceTable | null;
  /** The table's columns and its cards on canvases. */
  columns: readonly SourceColumn[];
  canvasItems: readonly CanvasItem[];
  /** Mappings and inputs reading any of the columns, with their attributes and entities for the message. */
  mappings: readonly Mapping[];
  mappingInputs: readonly MappingInput[];
  attributes: readonly Attribute[];
  entities: readonly Entity[];
  /** The workspace's label links and notes (slice 3a). */
  labelLinks?: readonly LabelLink[];
  notes?: readonly Note[];
  /** The workspace's requirement links (slice 4a): those on the table and its columns go with them. */
  requirementLinks?: readonly RequirementLink[];
  /** The workspace's classification links (slice 7c): those on the table and its columns go with them. */
  classificationLinks?: readonly ClassificationLink[];
  /** The workspace's source relationships and their column pairs (slice 7a): those from or to the table go with it. */
  relationships?: readonly SourceRelationship[];
  relationshipColumns?: readonly SourceRelationshipColumn[];
}

/** The live relationships from or to a table (slice 7a), with their live column pairs. */
export function relationshipsOfTable(
  workspaceId: Uuid,
  tableId: Uuid,
  relationships: readonly SourceRelationship[] = [],
  relationshipColumns: readonly SourceRelationshipColumn[] = [],
): { relationships: SourceRelationship[]; columns: SourceRelationshipColumn[] } {
  const rels = relationships.filter((r) => isLive(r, workspaceId) && (r.source_table_id === tableId || r.to_source_table_id === tableId));
  const ids = new Set(rels.map((r) => r.id));
  return { relationships: rels, columns: relationshipColumns.filter((c) => isLive(c, workspaceId) && ids.has(c.source_relationship_id)) };
}

/**
 * Deletes a source table from the model with everything that goes with it (slice 7b, Q7: the change's “Delete…” and
 * this are one cascade, `sourceDeleteCascade`): its columns, cards, relationships in both directions, the label and
 * requirement links on them, and the mappings that read its columns (a combined mapping that keeps other inputs loses
 * only these, D-49, and an approved one goes back to review, D-51). Notes pinned to its cards become free notes. The
 * panel shows all of it first (D-47). The open changes on it settle through `runCommand`'s settle rule (Q12). Until
 * slice 7b it refused while a mapping read one of its columns.
 */
export function deleteSourceTable(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: DeleteSourceTableState,
  input: unknown,
): CommandResult<{ columns: number; mappings: number }> {
  const parsed = begin(access, "model.edit", deleteSourceTableInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.table, access, parsed.data.sourceTableId, parsed.data.expectedVersion, "source table");
  if (!got.ok) return fail(got.error);
  const workspaceId = access.workspace.id;
  const mine = <R extends { workspace_id: Uuid; deleted_at: string | null }>(rows: readonly R[] | undefined): R[] => (rows ?? []).filter((r) => isLive(r, workspaceId));
  const rows: SourceDeleteRows = {
    tables: [got.row],
    columns: mine(state.columns),
    mappings: mine(state.mappings),
    mappingInputs: mine(state.mappingInputs),
    attributes: state.attributes,
    entities: state.entities,
    relationships: mine(state.relationships),
    relationshipColumns: mine(state.relationshipColumns),
    canvasItems: mine(state.canvasItems),
    notes: state.notes,
    labelLinks: state.labelLinks,
    requirementLinks: state.requirementLinks,
    classificationLinks: state.classificationLinks,
  };
  const cascade = sourceDeleteCascade(rows, { tableId: got.row.id })!;
  return done(ctx, access, { columns: cascade.columns.length, mappings: cascade.mappings.length + cascade.narrowed.length }, sourceDeleteEdits(ctx, rows, cascade));
}
