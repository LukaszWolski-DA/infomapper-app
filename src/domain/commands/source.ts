// Sources in slice 1a: “New source table” (a simple manual entry: system, database, schema, name, and the columns typed
// as lines), the column classification (BK, PII) and comment, and deleting a table no mapping reads from.
// Import of sources comes later.

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
  type Entity,
  type LabelLink,
  type Mapping,
  type MappingInput,
  type Note,
  type SourceColumn,
  type SourceSystem,
  type SourceTable,
} from "../types";
import { nameSchema, optionalTextSchema, uuidSchema, versionSchema } from "../validation";
import { linksOnItems, softDeleteLinks } from "./label";
import { releaseNotes } from "./note";
import { begin, current, done, isLive, nothingToChange, softDelete } from "./shared";

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
    row_count: null,
    comment: null,
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
}

/**
 * Deletes a source table with its columns and its cards, only when no mapping reads any of its columns; otherwise
 * refuses and lists those mappings. The source system stays. Slice 3a: the label links on the table and its columns
 * go with them; notes pinned to its cards become free notes at their place.
 */
export function deleteSourceTable(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: DeleteSourceTableState,
  input: unknown,
): CommandResult<{ columns: number }> {
  const parsed = begin(access, "model.edit", deleteSourceTableInput, input);
  if (!parsed.ok) return fail(parsed.error);
  const got = current(state.table, access, parsed.data.sourceTableId, parsed.data.expectedVersion, "source table");
  if (!got.ok) return fail(got.error);
  const table = got.row;
  const workspaceId = access.workspace.id;
  const columns = state.columns.filter((c) => isLive(c, workspaceId) && c.source_table_id === table.id);
  const columnById = new Map(columns.map((c) => [c.id, c]));
  const liveMappings = new Map(state.mappings.filter((m) => isLive(m, workspaceId)).map((m) => [m.id, m]));
  const used = state.mappingInputs.filter(
    (i) => isLive(i, workspaceId) && columnById.has(i.source_column_id) && liveMappings.has(i.mapping_id),
  );

  if (used.length) {
    const attributes = new Map(state.attributes.map((a) => [a.id, a]));
    const entities = new Map(state.entities.map((e) => [e.id, e]));
    const list = [
      ...new Set(
        used.map((i) => {
          const attribute = attributes.get(liveMappings.get(i.mapping_id)!.attribute_id);
          const target = attribute ? `${entities.get(attribute.entity_id)?.name ?? "?"}.${attribute.name}` : "?";
          return `${columnById.get(i.source_column_id)!.name} → ${target}`;
        }),
      ),
    ].sort();
    return fail(domainError("conflict", `Remove its mappings first. ${list.join("; ")}.`, { mappings: list.join("\n") }));
  }

  const cards = state.canvasItems.filter((c) => isLive(c, workspaceId) && c.source_table_id === table.id);
  return done(ctx, access, { columns: columns.length }, [
    ...cards.map((c) => softDelete(ctx, "canvas_item", c)),
    ...columns.map((c) => softDelete(ctx, "source_column", c)),
    softDelete(ctx, "source_table", table),
    ...softDeleteLinks(ctx, linksOnItems(state.labelLinks, [{ kind: "source_table", id: table.id }, ...columns.map((c) => ({ kind: "source_column" as const, id: c.id }))])),
    ...releaseNotes(ctx, state.notes, { items: cards, frames: [] }, { cardIds: cards.map((c) => c.id) }),
  ]);
}
