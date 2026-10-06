// D-48: what happens when a column is mapped to an attribute that already has mappings (by dragging it onto the
// attribute's row, or with “Map to an attribute” in the column panel). The person chooses between a separate mapping
// (an alternative source) and adding the column to one of the existing mappings; the hint pre-selects “add” when an
// existing mapping already reads a column of the same source table, otherwise “separate” (another system, or another
// table of the same system).

import type { Uuid } from "../ids";
import type { Mapping, MappingInput, SourceColumn } from "../types";

export type MappingChoice = { kind: "separate" } | { kind: "add"; mappingId: Uuid };

export type MapColumnPlan =
  /** The attribute has no mapping yet: a direct mapping, no question. */
  | { kind: "create" }
  /** The column already feeds this attribute: nothing to create (“That mapping already exists.”). */
  | { kind: "exists"; mappingId: Uuid }
  /** Ask: the options in order (“Separate mapping” first, then one “Add to mapping …” per mapping) and the hint. */
  | { kind: "choose"; options: MappingChoice[]; preselected: number };

/**
 * Decides how to map `column` to an attribute, given the attribute's live mappings and their live inputs, and the
 * columns those inputs read (to know their tables).
 */
export function planMapColumn(
  column: Pick<SourceColumn, "id" | "source_table_id">,
  mappings: readonly Pick<Mapping, "id">[],
  inputs: readonly Pick<MappingInput, "mapping_id" | "source_column_id" | "sort_order">[],
  columnOf: (columnId: Uuid) => Pick<SourceColumn, "source_table_id"> | undefined,
): MapColumnPlan {
  if (mappings.length === 0) return { kind: "create" };
  const inputsOf = (m: Pick<Mapping, "id">) => inputs.filter((i) => i.mapping_id === m.id).sort((a, b) => a.sort_order - b.sort_order);
  const feeding = mappings.find((m) => inputsOf(m).some((i) => i.source_column_id === column.id));
  if (feeding) return { kind: "exists", mappingId: feeding.id };

  const options: MappingChoice[] = [{ kind: "separate" }, ...mappings.map((m) => ({ kind: "add" as const, mappingId: m.id }))];
  const sameTable = mappings.findIndex((m) => inputsOf(m).some((i) => columnOf(i.source_column_id)?.source_table_id === column.source_table_id));
  return { kind: "choose", options, preselected: sameTable < 0 ? 0 : sameTable + 1 };
}

/**
 * A column dropped on an entity card's header (slice 1b): the entity's attribute named like the column, ignoring case,
 * if there is one. The column is then mapped to it (with the choice above when it has mappings) instead of adding a
 * second attribute of that name.
 */
export function attributeNamedAfter<A extends { name: string }>(attributes: readonly A[], column: Pick<SourceColumn, "name">): A | undefined {
  const name = column.name.toLowerCase();
  return attributes.find((a) => a.name.toLowerCase() === name);
}
