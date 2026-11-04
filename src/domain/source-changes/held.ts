// The rows a change-to-resolve action may write, as the browser can know them (slice 14b, O4): only the server knows
// exactly which tables, columns and mappings an action touches, so the page holds the rows the change names while the
// action is on its way. Its panels' saves of those rows wait for the action's answer and send the versions it brings.
//
// Step 3 measured holding the whole source system (step 1's agreement) at 28 ms for the first action on a page with
// 20,000 columns, over the bar of 20 ms, so the hold is the narrow one of step 1's answer 3: the change's tables (its
// own, and a move's target), all their columns, the mappings reading those columns and those mappings' inputs; for
// "Approve again all", the mappings it approves.

import type { Uuid } from "../ids";
import type { MappingInput, SourceColumn } from "../types";

export interface HeldRows {
  columns: readonly Pick<SourceColumn, "id" | "source_table_id">[];
  mappingInputs: readonly Pick<MappingInput, "id" | "mapping_id" | "source_column_id">[];
}

/** The mappings given and all their inputs (a save of a mapping writes them together). */
export function mappingRowIds(rows: Pick<HeldRows, "mappingInputs">, mappingIds: Iterable<Uuid>): Uuid[] {
  const mappings = new Set(mappingIds);
  const ids: Uuid[] = [...mappings];
  for (const i of rows.mappingInputs) if (mappings.has(i.mapping_id)) ids.push(i.id);
  return ids;
}

/** The tables given, all their columns, every mapping with an input on one of those columns, and its inputs. */
export function tableRowIds(rows: HeldRows, tableIds: Iterable<Uuid>): Uuid[] {
  const tables = new Set(tableIds);
  const columns = new Set<Uuid>();
  for (const c of rows.columns) if (tables.has(c.source_table_id)) columns.add(c.id);
  const mappings = new Set<Uuid>();
  for (const i of rows.mappingInputs) if (columns.has(i.source_column_id)) mappings.add(i.mapping_id);
  return [...tables, ...columns, ...mappingRowIds(rows, mappings)];
}
