// “New source table” (slice 1a): a simple manual entry. System, database, schema, name, and the columns typed as
// lines. Import of sources comes later.

import { z } from "zod";
import { fail, newRowColumns, type CommandContext, type CommandResult, type Write } from "../changes";
import { domainError } from "../errors";
import type { Uuid } from "../ids";
import { parseColumnLines } from "../model/column-lines";
import type { WorkspaceAccess } from "../permissions";
import { SOURCE_OBJECT_TYPES, type SourceColumn, type SourceSystem, type SourceTable } from "../types";
import { nameSchema } from "../validation";
import { begin, done, isLive } from "./shared";

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
