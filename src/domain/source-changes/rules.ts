// Rules of changes to resolve (slice 7b, P3–P8; step 1 answers Q6, Q10, Q12, Q13): which kinds are about a mapping,
// how a change is raised and settled, when a mapping fits the source again, and when an input or a mapping is
// historical. Pure; the commands (step 3) turn the edits into writes with their change events.
//   Historical (Q10): an input is historical when its column is retired; a mapping only when every input is. Its
//   “until” is the column's `missing_since` (the day it left the source). A column that comes back loses both statuses,
//   so nothing more is stored.

import { nextVersion, newRowColumns, type CommandContext, type Write } from "../changes";
import type { Uuid } from "../ids";
import { checkMappingTypes, formatAttributeType, formatColumnType } from "../model/type-check";
import type { Attribute, Mapping, MappingInput, SourceChange, SourceChangeKind, SourceChangeSeverity, SourceColumn, Timestamp, WritableRows } from "../types";
import { INPUT_MISSING, isoDate } from "./texts";

/** The rows a change's action may write: the commands' tables and `source_change` (registered in step 3). */
export interface ChangeRows extends WritableRows {
  source_change: SourceChange;
}

/** A row a change's action writes: what commands write, plus changes to resolve. */
export type Edit =
  | Write
  | { kind: "insert"; table: "source_change"; row: SourceChange }
  | { kind: "update"; table: "source_change"; before: SourceChange; row: SourceChange };

export const MAPPING_KINDS: ReadonlySet<SourceChangeKind> = new Set(["type_conflict", "business_key_changed", "rule_updated"]);
export const isMappingKind = (kind: SourceChangeKind): boolean => MAPPING_KINDS.has(kind);

const live = <R extends { deleted_at: Timestamp | null }>(rows: readonly R[]): R[] => rows.filter((r) => r.deleted_at === null);

export const isOpen = (c: SourceChange): boolean => c.deleted_at === null && c.status === "open";

/** Open changes first by severity (high first), then oldest first (the system panel's order, item 20). */
export const byPriority = (a: SourceChange, b: SourceChange): number =>
  (a.severity === "high" ? 0 : 1) - (b.severity === "high" ? 0 : 1) || a.created_at.localeCompare(b.created_at);

/** What a raised change says, before ids and standard columns. */
export interface RaisedChange {
  kind: SourceChangeKind;
  severity: SourceChangeSeverity;
  source_table_id: Uuid | null;
  source_column_id: Uuid | null;
  mapping_id: Uuid | null;
  object_label: string;
  detail: string;
}

/** A new open change of a system, raised by an import (or by “Decide column by column”, keeping its import). */
export function newChange(ctx: CommandContext, workspaceId: Uuid, systemId: Uuid, importId: Uuid, c: RaisedChange): SourceChange {
  return {
    ...newRowColumns(ctx),
    workspace_id: workspaceId,
    source_system_id: systemId,
    source_import_id: importId,
    status: "open",
    resolution: null,
    resolved_by: null,
    resolved_at: null,
    ...c,
  };
}

/** The columns a settled change gets. */
export const settledColumns = (ctx: Pick<CommandContext, "actorId" | "now">, resolution: string): Partial<SourceChange> => ({
  status: "resolved",
  resolution,
  resolved_by: ctx.actorId,
  resolved_at: ctx.now,
});

/** Settles the open changes that match, each with the resolution `text` gives it. */
export function settle(ctx: CommandContext, changes: readonly SourceChange[] | undefined, match: (c: SourceChange) => boolean, text: string | ((c: SourceChange) => string)): Edit[] {
  const out: Edit[] = [];
  for (const c of changes ?? []) {
    if (!isOpen(c) || !match(c)) continue;
    out.push({ kind: "update", table: "source_change", before: c, row: nextVersion(ctx, c, settledColumns(ctx, typeof text === "string" ? text : text(c))) });
  }
  return out;
}

// ---- historical inputs and mappings (Q10) ----

export const isRetired = (c: Pick<SourceColumn, "retired_since">): boolean => !!c.retired_since;

/** “until 2026-10-23” for a retired input: the day its column left the source. */
export const untilOf = (c: Pick<SourceColumn, "retired_since" | "missing_since">): string | null =>
  c.retired_since ? isoDate(c.missing_since ?? c.retired_since) : null;

/** A mapping is historical when every input is retired (a combined mapping with one retired input is not). */
export const isHistorical = (inputs: readonly Pick<SourceColumn, "retired_since">[]): boolean => inputs.length > 0 && inputs.every(isRetired);

/** The latest “until” of a historical mapping's inputs; null when the mapping is not historical. */
export function mappingUntil(inputs: readonly Pick<SourceColumn, "retired_since" | "missing_since">[]): string | null {
  if (!isHistorical(inputs)) return null;
  return inputs.map(untilOf).reduce<string | null>((max, d) => (d && (!max || d > max) ? d : max), null);
}

/** The live input columns of a mapping, in rule order. */
export function inputColumnsOf(mappingId: Uuid, inputs: readonly MappingInput[], columns: readonly SourceColumn[]): SourceColumn[] {
  const byId = new Map(columns.map((c) => [c.id, c]));
  return live(inputs)
    .filter((i) => i.mapping_id === mappingId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => byId.get(i.source_column_id))
    .filter((c): c is SourceColumn => !!c && c.deleted_at === null);
}

// ---- fits the source (P8) ----

/**
 * Whether a mapping fits the source, so it may be approved again (P8, Q11): no input missing from source, and the type
 * check of every input passes. Not fitting: the reasons, worded for the list apart (“These don't fit the source yet”).
 */
export function fitsSource(mapping: Pick<Mapping, "kind" | "rule_expression">, attribute: Attribute, inputs: readonly SourceColumn[]): { fits: true } | { fits: false; reasons: string[] } {
  const reasons: string[] = inputs.filter((c) => c.missing_since).map((c) => INPUT_MISSING(c.name));
  const check = checkMappingTypes(mapping, attribute, inputs);
  for (const p of check.problems) {
    const c = inputs.find((x) => x.id === p.source_column_id);
    if (c) reasons.push(`type conflict, ${formatColumnType(c)} into ${formatAttributeType(attribute)}`);
  }
  return reasons.length ? { fits: false, reasons } : { fits: true };
}

/** The columns a mapping's approval writes (as `setMappingStatus`): who and when, and no import reason. */
export const approvalColumns = (ctx: Pick<CommandContext, "actorId" | "now">): Partial<Mapping> => ({
  status: "approved",
  approved_by: ctx.actorId,
  approved_at: ctx.now,
  review_reason: null,
});
