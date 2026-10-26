// Changes settled elsewhere (slice 7b, P7; step 1 answer Q12 and the open points after it): when the object of an open
// change is deleted, or its question is answered by another command, the change settles in that command's change
// group with a resolution that says where it came from. Never silently dropped.
//   - a deleted entity, attribute or mapping (`deleteEntity`, `deleteAttribute`, `deleteMapping`): the changes on the
//     mappings that go, “Settled: the {entity|attribute|mapping} was deleted”;
//   - merged mappings (`mergeMappings`): “Settled: the mapping was merged into another”;
//   - a status set in the mapping panel (`setMappingStatus`): “Settled: the mapping was approved in its panel”, or
//     “Settled: the mapping's status was set to {Draft|In review} in its panel”;
//   - an input removed (`removeMappingInput`): the mapping's changes about that column, “Settled: {column} no longer
//     feeds the mapping”;
//   - a column mapped by any other path (`createMapping`, `addMappingInput`, a drag on the canvas, D-48): its new-column
//     change, “Settled: mapped to {Entity.attribute} ({status})”;
//   - a source table or column deleted (`deleteSourceTable`; the change's “Delete…” settles its own);
//   - slice 7c (Q7): a business key change without a mapping, when its column loses the Business key classification,
//     “Settled: {column} is no longer a business key”, or when Business key is removed from the list, “Settled: the
//     classification {name} was removed”. A mapping's business key change stays open: its question is the mapping's
//     review.
// `settleAfterWrites` reads them from any command's writes (step 3): the server runs it after the command, in the same
// change group, as it runs the live canvas rules, so no command needs to know about changes to resolve.

import type { CommandContext, Write } from "../changes";
import type { Uuid } from "../ids";
import type { Attribute, Classification, ClassificationLink, Entity, Mapping, MappingInput, MappingStatus, SourceChange, SourceColumn } from "../types";
import { isMappingKind, isOpen, settle, type Edit } from "./rules";
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

/** An open business key change without a mapping on one of the columns (Q7). */
const isColumnBusinessKeyChange = (columnIds: ReadonlySet<Uuid>) => (c: SourceChange) =>
  c.kind === "business_key_changed" && c.mapping_id === null && c.source_column_id !== null && columnIds.has(c.source_column_id);

/** How many open business key changes settle when these columns lose Business key (the removal form's count). */
export const businessKeySettlements = (changes: readonly SourceChange[], columnIds: ReadonlySet<Uuid>): number =>
  changes.filter((c) => isOpen(c) && isColumnBusinessKeyChange(columnIds)(c)).length;

/** Names the settlements need: the workspace's live model before the write. */
export interface SettleNames {
  entities: readonly Entity[];
  attributes: readonly Attribute[];
  mappings: readonly Mapping[];
  sourceColumns: readonly SourceColumn[];
  /** The classification list (slice 7c): which removed link was a Business key. */
  classifications?: readonly Classification[];
}

const BOOKKEEPING = new Set(["version", "updated_at", "updated_by"]);
const STATUS_COLUMNS = new Set(["status", "approved_by", "approved_at", "review_reason"]);

/** Only the mapping's status columns changed: the panel's status control (`setMappingStatus`). */
function statusOnly(before: Mapping, row: Mapping): boolean {
  const changed = Object.keys({ ...before, ...row }).filter(
    (k) => !BOOKKEEPING.has(k) && JSON.stringify((before as unknown as Record<string, unknown>)[k]) !== JSON.stringify((row as unknown as Record<string, unknown>)[k]),
  );
  return changed.length > 0 && changed.every((k) => STATUS_COLUMNS.has(k));
}

/**
 * The settlements a command's writes call for (Q12), for the open changes the writes do not settle themselves. An
 * import's writes are its own (it raises and settles by the source, P7) and get none.
 */
export function settleAfterWrites(ctx: CommandContext, writes: readonly Write[], changes: readonly SourceChange[], names: SettleNames): Edit[] {
  if (writes.some((w) => w.table === "source_import")) return [];
  const touched = new Set(writes.filter((w) => w.table === "source_change" && w.kind !== "insert").map((w) => (w as { before: SourceChange }).before.id));
  let open = changes.filter((c) => isOpen(c) && !touched.has(c.id));
  if (!open.length) return [];
  const out: Edit[] = [];
  const take = (edits: Edit[]) => {
    out.push(...edits);
    const done = new Set(edits.map((e) => (e as { before: SourceChange }).before.id));
    open = open.filter((c) => !done.has(c.id));
  };
  const updates = <T extends Write["table"]>(table: T) =>
    writes.filter((w): w is Extract<Write, { kind: "update"; table: T }> => w.kind === "update" && w.table === table);
  const deletedOf = <T extends Write["table"]>(table: T) =>
    updates(table).filter((w) => (w.before as { deleted_at: string | null }).deleted_at === null && (w.row as { deleted_at: string | null }).deleted_at !== null);
  const attribute = new Map(names.attributes.map((a) => [a.id, a]));
  const entity = new Map(names.entities.map((e) => [e.id, e]));
  const column = new Map(names.sourceColumns.map((c) => [c.id, c]));
  const mappingAfter = new Map(names.mappings.map((m) => [m.id, m]));
  for (const w of writes) if (w.table === "mapping") mappingAfter.set(w.row.id, w.row);
  const labelOf = (attributeId: Uuid) => {
    const a = attribute.get(attributeId);
    return a ? `${entity.get(a.entity_id)?.name ?? "?"}.${a.name}` : "?";
  };

  // deleted mappings: with their entity, their attribute, merged into another, or by themselves
  const goneMappings = deletedOf("mapping").map((w) => w.before);
  if (goneMappings.length) {
    const kept = updates("mapping").filter((w) => w.row.deleted_at === null);
    const what = deletedOf("entity").length ? "entity" : deletedOf("attribute").length ? "attribute" : null;
    for (const m of goneMappings) {
      const merged = !what && kept.some((k) => k.row.attribute_id === m.attribute_id);
      take(merged ? settleMergedMappings(ctx, open, [m.id]) : settleDeletedMappings(ctx, open, [m.id], what ?? "mapping"));
    }
  }
  // deleted source tables and columns
  const goneTables = new Set(deletedOf("source_table").map((w) => w.before.id));
  const goneColumns = new Set(deletedOf("source_column").map((w) => w.before.id));
  if (goneTables.size || goneColumns.size) {
    take(settle(ctx, open, (c) => !!c.source_table_id && goneTables.has(c.source_table_id) && !c.source_column_id && !c.mapping_id, SETTLED.deleted("table")));
    take(settle(ctx, open, (c) => !!c.source_column_id && goneColumns.has(c.source_column_id), SETTLED.deleted(goneTables.size ? "table" : "column")));
  }
  // columns that lose Business key (slice 7c, Q7): a toggle, or the classification removed with its links
  const goneLinks = deletedOf("classification_link").map((w) => w.before as ClassificationLink);
  if (goneLinks.length) {
    const removed = new Map(deletedOf("classification").map((w) => [w.before.id, w.before as Classification]));
    const classification = new Map((names.classifications ?? []).map((c) => [c.id, c]));
    for (const l of goneLinks) {
      const c = removed.get(l.classification_id) ?? classification.get(l.classification_id);
      if (c?.code !== "BK" || !l.source_column_id) continue;
      const text = removed.has(c.id) ? SETTLED.classificationRemoved(c.name) : SETTLED.noLongerBusinessKey(column.get(l.source_column_id)?.name ?? "the column");
      take(settle(ctx, open, isColumnBusinessKeyChange(new Set([l.source_column_id])), text));
    }
  }
  // a status set in the mapping panel: only the status changed, and no input with it (an input change of an approved
  // mapping writes the same columns on the mapping, D-51)
  const inputsOf = new Set(writes.flatMap((w) => (w.table === "mapping_input" ? [w.row.mapping_id] : [])));
  for (const w of updates("mapping")) {
    if (w.row.deleted_at === null && w.before.status !== w.row.status && statusOnly(w.before, w.row) && !inputsOf.has(w.row.id)) take(settleByStatus(ctx, open, w.row.id, w.row.status));
  }
  // inputs removed from a mapping that stays
  const goneMappingIds = new Set(goneMappings.map((m) => m.id));
  for (const w of deletedOf("mapping_input")) {
    const i = w.before as MappingInput;
    if (goneMappingIds.has(i.mapping_id)) continue;
    const c = column.get(i.source_column_id);
    if (c) take(settleRemovedInput(ctx, open, i.mapping_id, { id: c.id, name: c.name }));
  }
  // a column given a mapping: a new input, or an input pointed at it
  for (const w of writes) {
    if (w.table !== "mapping_input") continue;
    const i = w.row as MappingInput;
    if (i.deleted_at !== null || (w.kind === "update" && (w.before as MappingInput).source_column_id === i.source_column_id)) continue;
    const m = mappingAfter.get(i.mapping_id);
    if (m) take(settleMappedColumn(ctx, open, i.source_column_id, labelOf(m.attribute_id), m.status));
  }
  return out;
}
