// Changes settled elsewhere (slice 7b, P7; step 1 answer Q12 and the open points after it): when the object of an open
// change is deleted, or its question is answered by another command, the change settles in that command's change
// group with a resolution that says where it came from. Never silently dropped. Step 3 calls these from the commands:
//   - a deleted entity, attribute or mapping (`deleteEntity`, `deleteAttribute`, `deleteMapping`): the changes on the
//     mappings that go, “Settled: the {entity|attribute|mapping} was deleted”;
//   - merged mappings (`mergeMappings`): “Settled: the mapping was merged into another”;
//   - a status set in the mapping panel (`setMappingStatus`): “Settled: the mapping was approved in its panel”, or
//     “Settled: the mapping's status was set to {Draft|In review} in its panel”;
//   - an input removed (`removeMappingInput`): the mapping's changes about that column, “Settled: {column} no longer
//     feeds the mapping”;
//   - a column mapped by any other path (`createMapping`, `addMappingInput`, a drag on the canvas, D-48): its new-column
//     change, “Settled: mapped to {Entity.attribute} ({status})”;
//   - a source table or column deleted: `sourceDeleteEdits` (delete.ts) settles them.

import type { CommandContext } from "../changes";
import type { Uuid } from "../ids";
import type { MappingStatus, SourceChange } from "../types";
import { isMappingKind, settle, type Edit } from "./rules";
import { SETTLED, STATUS_WORD } from "./texts";

/** Mappings that went with an entity, an attribute or by themselves. */
export function settleDeletedMappings(ctx: CommandContext, changes: readonly SourceChange[] | undefined, mappingIds: Iterable<Uuid>, what: "entity" | "attribute" | "mapping"): Edit[] {
  const ids = new Set(mappingIds);
  return settle(ctx, changes, (c) => c.mapping_id !== null && ids.has(c.mapping_id), SETTLED.deleted(what));
}

/** Mappings merged into another (D-49). */
export function settleMergedMappings(ctx: CommandContext, changes: readonly SourceChange[] | undefined, mappingIds: Iterable<Uuid>): Edit[] {
  const ids = new Set(mappingIds);
  return settle(ctx, changes, (c) => c.mapping_id !== null && ids.has(c.mapping_id), SETTLED.merged);
}

/** A mapping's status set in its panel: it answers the review its changes ask for. */
export function settleByStatus(ctx: CommandContext, changes: readonly SourceChange[] | undefined, mappingId: Uuid, status: MappingStatus): Edit[] {
  const text = status === "approved" ? SETTLED.approvedInPanel : SETTLED.statusInPanel(status === "review" ? "In review" : "Draft");
  return settle(ctx, changes, (c) => c.mapping_id === mappingId && isMappingKind(c.kind), text);
}

/** An input removed from a mapping: its changes about that column. */
export function settleRemovedInput(ctx: CommandContext, changes: readonly SourceChange[] | undefined, mappingId: Uuid, column: { id: Uuid; name: string }): Edit[] {
  return settle(ctx, changes, (c) => c.mapping_id === mappingId && c.source_column_id === column.id, SETTLED.inputRemoved(column.name));
}

/** A new column given a mapping by any path other than its change's “Map to an attribute…”. */
export function settleMappedColumn(ctx: CommandContext, changes: readonly SourceChange[] | undefined, columnId: Uuid, attribute: string, status: MappingStatus): Edit[] {
  return settle(ctx, changes, (c) => c.kind === "new_column" && c.source_column_id === columnId, SETTLED.mappedElsewhere(attribute, STATUS_WORD[status]));
}
