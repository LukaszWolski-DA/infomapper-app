// The actions that settle a change to resolve (slice 7b, items 10–18, P5–P10; prototype `ACTS`, `issueAction`,
// `confirmPending`, `pendingHtml`), as pure functions: each returns the rows it writes, the change settled with its
// resolution, in what step 3's command makes one change group and one undo step. Permissions, versions and the
// archive are the command's (step 3); these check what the data allows.
//   Move (Q5, question 8): each mapping reading the column reads the chosen one instead, by its input; a combined
//   mapping that already reads the target loses the old input instead; a direct mapping whose attribute already has a
//   direct mapping from the target is refused. Approved ones go back to review with “moved from …”.
//   Approve again (P8, Q11): only a mapping in review that fits the source, with four-eyes as the mapping panel.
//   Approve again all (P9, Q11): the open mapping changes of one import; those that don't fit are listed first and
//   left in review, then those four-eyes keeps from this person; a mapping in both is listed under “don't fit” only.

import { nextVersion, newRowColumns, type CommandContext } from "../changes";
import { domainError, notFound, type DomainError } from "../errors";
import type { Uuid } from "../ids";
import { rewriteRule } from "../import/plan";
import { afterContentChange, checkFourEyes } from "../model/mapping-rules";
import { formatColumnType } from "../model/type-check";
import type { Attribute, Entity, Mapping, MappingInput, SourceChange, SourceColumn, SourceTable, Workspace } from "../types";
import { sourceDeleteCascade, sourceDeleteEdits, type SourceDeleteRows } from "./delete";
import { approvalColumns, fitsSource, inputColumnsOf, isMappingKind, isOpen, newChange, settle, type Edit } from "./rules";
import {
  CHANGE_RESOLVED,
  DETAIL,
  DOES_NOT_FIT,
  MOVE_DROPS_INPUT,
  MOVE_DUPLICATE,
  MOVED_REASON,
  NOT_IN_REVIEW,
  RESOLUTION,
  SETTLED,
  type SourceChangeAction,
} from "./texts";

/** The workspace's rows the actions read. */
export interface ChangeActionRows {
  tables: readonly SourceTable[];
  columns: readonly SourceColumn[];
  mappings: readonly Mapping[];
  mappingInputs: readonly MappingInput[];
  attributes: readonly Attribute[];
  entities: readonly Entity[];
  changes: readonly SourceChange[];
}

export type ActionResult = { ok: true; edits: Edit[]; resolution: string; change: SourceChange } | { ok: false; error: DomainError };

const live = <R extends { deleted_at: string | null }>(rows: readonly R[]): R[] => rows.filter((r) => r.deleted_at === null);
const refuse = (message: string): ActionResult => ({ ok: false, error: domainError("conflict", message) });

function openChange(rows: Pick<ChangeActionRows, "changes">, changeId: Uuid, kinds: readonly SourceChange["kind"][]): { ok: true; change: SourceChange } | { ok: false; error: DomainError } {
  const change = rows.changes.find((c) => c.id === changeId && c.deleted_at === null);
  if (!change || !kinds.includes(change.kind)) return { ok: false, error: notFound("change") };
  if (!isOpen(change)) return { ok: false, error: domainError("conflict", CHANGE_RESOLVED) };
  return { ok: true, change };
}

const liveColumn = (rows: ChangeActionRows, id: Uuid | null) => (id ? live(rows.columns).find((c) => c.id === id) : undefined);

/** “Customer.email”. */
export function attributeLabel(rows: Pick<ChangeActionRows, "attributes" | "entities">, attributeId: Uuid): string {
  const a = rows.attributes.find((x) => x.id === attributeId);
  return a ? `${rows.entities.find((e) => e.id === a.entity_id)?.name ?? "?"}.${a.name}` : "?";
}

/** The live mappings reading a column, with their live inputs. */
function mappingsReading(rows: ChangeActionRows, columnId: Uuid): { mapping: Mapping; inputs: MappingInput[] }[] {
  const inputs = live(rows.mappingInputs);
  return live(rows.mappings)
    .map((mapping) => ({ mapping, inputs: inputs.filter((i) => i.mapping_id === mapping.id).sort((a, b) => a.sort_order - b.sort_order) }))
    .filter((m) => m.inputs.some((i) => i.source_column_id === columnId));
}

/** Whether the change's mapping may be approved again now (P8): in review, and fits the source. */
export function canApproveAgain(rows: ChangeActionRows, change: SourceChange): boolean {
  const m = change.mapping_id ? live(rows.mappings).find((x) => x.id === change.mapping_id) : undefined;
  const a = m && rows.attributes.find((x) => x.id === m.attribute_id && x.deleted_at === null);
  if (!m || !a || m.status !== "review") return false;
  return fitsSource(m, a, inputColumnsOf(m.id, rows.mappingInputs, rows.columns)).fits;
}

/** The actions a change's card offers (item 10); a business key change without a mapping only takes note. */
export function actionsFor(rows: ChangeActionRows, change: SourceChange): SourceChangeAction[] {
  if (!isOpen(change)) return [];
  switch (change.kind) {
    case "column_left":
      return ["retire", "move", "delete"];
    case "table_left":
      return ["retire", "delete"];
    case "new_column":
      return ["map", "not_needed"];
    case "new_table":
      return ["not_needed", "split"];
    default:
      if (!change.mapping_id) return ["noted"];
      return canApproveAgain(rows, change) ? ["approve", "leave"] : ["leave"];
  }
}

// ---- retire (P6, item 11) ----

export function retire(ctx: CommandContext, rows: ChangeActionRows, changeId: Uuid): ActionResult {
  const got = openChange(rows, changeId, ["column_left", "table_left"]);
  if (!got.ok) return got;
  const change = got.change;
  const edits: Edit[] = [];
  const retireColumn = (c: SourceColumn) => {
    if (!c.retired_since) edits.push({ kind: "update", table: "source_column", before: c, row: nextVersion(ctx, c, { retired_since: ctx.now }) });
  };
  if (change.kind === "column_left") {
    const column = liveColumn(rows, change.source_column_id);
    if (!column) return { ok: false, error: notFound("source column") };
    if (!column.missing_since) return refuse(CHANGE_RESOLVED);
    retireColumn(column);
  } else {
    const table = live(rows.tables).find((t) => t.id === change.source_table_id);
    if (!table) return { ok: false, error: notFound("source table") };
    if (!table.missing_since) return refuse(CHANGE_RESOLVED);
    edits.push({ kind: "update", table: "source_table", before: table, row: nextVersion(ctx, table, { retired_since: ctx.now }) });
    const missing = live(rows.columns).filter((c) => c.source_table_id === table.id && c.missing_since);
    missing.forEach(retireColumn);
    // a column that left before its table did has its own change: retiring the table answers it too
    const ids = new Set(missing.map((c) => c.id));
    edits.push(...settle(ctx, rows.changes, (c) => c.id !== change.id && c.kind === "column_left" && ids.has(c.source_column_id!), SETTLED.tableRetired));
  }
  edits.push(...settle(ctx, [change], () => true, RESOLUTION.retired));
  return { ok: true, edits, resolution: RESOLUTION.retired, change };
}

// ---- move its mappings (item 12, Q5) ----

/** The columns a mapping may move to (item 12): the system's present columns, the change's table first, each with its type. */
export function moveTargets(rows: ChangeActionRows, change: SourceChange): { table: SourceTable; columns: { id: Uuid; name: string; type: string }[] }[] {
  const from = liveColumn(rows, change.source_column_id);
  const fromTable = from ? rows.tables.find((t) => t.id === from.source_table_id) : undefined;
  if (!from || !fromTable) return [];
  const tables = live(rows.tables)
    .filter((t) => t.source_system_id === fromTable.source_system_id && !t.missing_since)
    .sort((a, b) => (a.id === fromTable.id ? -1 : b.id === fromTable.id ? 1 : `${a.schema_name}.${a.name}`.localeCompare(`${b.schema_name}.${b.name}`)));
  return tables
    .map((table) => ({
      table,
      columns: live(rows.columns)
        .filter((c) => c.source_table_id === table.id && !c.missing_since && c.id !== from.id)
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((c) => ({ id: c.id, name: c.name, type: formatColumnType(c) })),
    }))
    .filter((g) => g.columns.length);
}

/** What moving does to each mapping, as the form shows it before the click. */
export interface MoveStep {
  mapping: Mapping;
  attribute: string;
  /** The input that reads the old column. */
  input: MappingInput;
  /** The mapping already reads the target: the old input is removed instead of moved (question 8). */
  dropsInput: boolean;
  /** Approved: goes back to review with “moved from …”. */
  backToReview: boolean;
  ruleAfter: string | null;
  /** A line for the form when the old input is removed. */
  note: string | null;
}

export function movePlan(rows: ChangeActionRows, change: SourceChange, targetId: Uuid): { ok: true; from: SourceColumn; target: SourceColumn; table: SourceTable; steps: MoveStep[] } | { ok: false; error: DomainError } {
  const from = liveColumn(rows, change.source_column_id);
  const target = liveColumn(rows, targetId);
  if (!from) return { ok: false, error: notFound("source column") };
  if (!target || target.missing_since || !moveTargets(rows, change).some((g) => g.columns.some((c) => c.id === targetId))) {
    return { ok: false, error: domainError("invalid", "Choose a column of the system that is in the source.") };
  }
  const table = rows.tables.find((t) => t.id === target.source_table_id)!;
  const steps: MoveStep[] = [];
  const allMappings = mappingsReading(rows, target.id);
  for (const { mapping, inputs } of mappingsReading(rows, from.id)) {
    const input = inputs.find((i) => i.source_column_id === from.id)!;
    const attribute = attributeLabel(rows, mapping.attribute_id);
    const dropsInput = inputs.some((i) => i.source_column_id === target.id);
    if (!dropsInput && inputs.length === 1) {
      // a direct mapping that would duplicate another mapping of the attribute from the target
      const twin = allMappings.find((m) => m.mapping.id !== mapping.id && m.mapping.attribute_id === mapping.attribute_id && m.inputs.length === 1);
      if (twin) return { ok: false, error: domainError("conflict", MOVE_DUPLICATE(attribute, target.name)) };
    }
    const ruleAfter = mapping.rule_expression ? rewriteRule(mapping.rule_expression, new Map([[from.name.toLowerCase(), target.name]])) : null;
    steps.push({ mapping, attribute, input, dropsInput, backToReview: mapping.status === "approved", ruleAfter, note: dropsInput ? MOVE_DROPS_INPUT(attribute, target.name, from.name) : null });
  }
  return { ok: true, from, target, table, steps };
}

export function moveMappings(ctx: CommandContext, rows: ChangeActionRows, changeId: Uuid, targetId: Uuid): ActionResult {
  const got = openChange(rows, changeId, ["column_left"]);
  if (!got.ok) return got;
  const plan = movePlan(rows, got.change, targetId);
  if (!plan.ok) return plan;
  const edits: Edit[] = [];
  for (const s of plan.steps) {
    const content = afterContentChange(s.mapping);
    const patch: Partial<Mapping> = { ...content.patch };
    if (s.ruleAfter !== null) patch.rule_expression = s.ruleAfter;
    if (s.backToReview) patch.review_reason = MOVED_REASON(plan.from.name);
    edits.push({ kind: "update", table: "mapping", before: s.mapping, row: nextVersion(ctx, s.mapping, patch) });
    edits.push(
      s.dropsInput
        ? { kind: "update", table: "mapping_input", before: s.input, row: nextVersion(ctx, s.input, { deleted_at: ctx.now }) }
        : { kind: "update", table: "mapping_input", before: s.input, row: nextVersion(ctx, s.input, { source_column_id: plan.target.id }) },
    );
  }
  if (!plan.from.retired_since) edits.push({ kind: "update", table: "source_column", before: plan.from, row: nextVersion(ctx, plan.from, { retired_since: ctx.now }) });
  const resolution = RESOLUTION.moved(plan.table.name, plan.target.name);
  edits.push(...settle(ctx, [got.change], () => true, resolution));
  edits.push(...settle(ctx, rows.changes, (c) => c.kind === "new_column" && c.source_column_id === plan.target.id, SETTLED.movedHere(plan.from.name)));
  return { ok: true, edits, resolution, change: got.change };
}

// ---- delete (item 13, Q4, Q7) ----

export function deleteForChange(ctx: CommandContext, rows: SourceDeleteRows & ChangeActionRows, changeId: Uuid): ActionResult {
  const got = openChange(rows, changeId, ["column_left", "table_left"]);
  if (!got.ok) return got;
  const c = got.change;
  const cascade = sourceDeleteCascade(rows, c.kind === "table_left" ? { tableId: c.source_table_id! } : { columnId: c.source_column_id! });
  if (!cascade) return { ok: false, error: notFound(c.kind === "table_left" ? "source table" : "source column") };
  return { ok: true, edits: sourceDeleteEdits(ctx, rows, cascade, c.id), resolution: RESOLUTION.deleted, change: c };
}

// ---- map to an attribute (item 14) ----

export function mapToAttribute(ctx: CommandContext, rows: ChangeActionRows, changeId: Uuid, attributeId: Uuid, workspaceId: Uuid): ActionResult {
  const got = openChange(rows, changeId, ["new_column"]);
  if (!got.ok) return got;
  const column = liveColumn(rows, got.change.source_column_id);
  if (!column) return { ok: false, error: notFound("source column") };
  const attribute = live(rows.attributes).find((a) => a.id === attributeId);
  if (!attribute) return { ok: false, error: notFound("attribute") };
  if (mappingsReading(rows, column.id).some((m) => m.mapping.attribute_id === attributeId)) return refuse("That mapping already exists.");
  const mapping: Mapping = {
    ...newRowColumns(ctx),
    workspace_id: workspaceId,
    attribute_id: attributeId,
    kind: "direct",
    rule_expression: null,
    status: "draft",
    note_html: null,
    note_text: null,
    approved_by: null,
    approved_at: null,
    review_reason: null,
  };
  const input: MappingInput = { ...newRowColumns(ctx), workspace_id: workspaceId, mapping_id: mapping.id, source_column_id: column.id, sort_order: 0 };
  const resolution = RESOLUTION.mapped(attributeLabel(rows, attributeId));
  return {
    ok: true,
    edits: [{ kind: "insert", table: "mapping", row: mapping }, { kind: "insert", table: "mapping_input", row: input }, ...settle(ctx, [got.change], () => true, resolution)],
    resolution,
    change: got.change,
  };
}

// ---- not needed, decide column by column, mark as needed (items 15, 18; P10) ----

export function markNotNeeded(ctx: CommandContext, rows: ChangeActionRows, changeId: Uuid): ActionResult {
  const got = openChange(rows, changeId, ["new_column", "new_table"]);
  if (!got.ok) return got;
  const c = got.change;
  const columns = c.kind === "new_column" ? [liveColumn(rows, c.source_column_id)].filter((x): x is SourceColumn => !!x) : live(rows.columns).filter((x) => x.source_table_id === c.source_table_id);
  if (!columns.length) return { ok: false, error: notFound("source column") };
  const edits: Edit[] = columns.filter((x) => !x.not_needed).map((x) => ({ kind: "update", table: "source_column", before: x, row: nextVersion(ctx, x, { not_needed: true }) }) as Edit);
  edits.push(...settle(ctx, [c], () => true, RESOLUTION.notNeeded));
  return { ok: true, edits, resolution: RESOLUTION.notNeeded, change: c };
}

/** “Decide column by column”: one `new_column` per column of the new table that has no mapping yet, same import. */
export function decideColumnByColumn(ctx: CommandContext, rows: ChangeActionRows, changeId: Uuid, workspaceId: Uuid): ActionResult {
  const got = openChange(rows, changeId, ["new_table"]);
  if (!got.ok) return got;
  const c = got.change;
  const table = live(rows.tables).find((t) => t.id === c.source_table_id);
  if (!table) return { ok: false, error: notFound("source table") };
  const mapped = new Set(live(rows.mappingInputs).filter((i) => live(rows.mappings).some((m) => m.id === i.mapping_id)).map((i) => i.source_column_id));
  const edits: Edit[] = live(rows.columns)
    .filter((x) => x.source_table_id === table.id && !mapped.has(x.id) && !x.missing_since)
    .sort((a, b) => a.ordinal - b.ordinal)
    .map(
      (x): Edit => ({
        kind: "insert",
        table: "source_change",
        row: newChange(ctx, workspaceId, c.source_system_id, c.source_import_id, {
          kind: "new_column",
          severity: "normal",
          source_table_id: table.id,
          source_column_id: x.id,
          mapping_id: null,
          object_label: `${table.schema_name}.${table.name}.${x.name}`,
          detail: DETAIL.newColumn(formatColumnType(x)),
        }),
      }),
    );
  edits.push(...settle(ctx, [c], () => true, RESOLUTION.split));
  return { ok: true, edits, resolution: RESOLUTION.split, change: c };
}

/** “Mark as needed” on a column marked not needed (P10): no change involved. */
export function markAsNeeded(ctx: CommandContext, column: SourceColumn): { ok: true; edits: Edit[] } | { ok: false; error: DomainError } {
  if (column.deleted_at !== null) return { ok: false, error: notFound("source column") };
  if (!column.not_needed) return { ok: false, error: domainError("invalid", "Nothing to change.") };
  return { ok: true, edits: [{ kind: "update", table: "source_column", before: column, row: nextVersion(ctx, column, { not_needed: false }) }] };
}

// ---- approve again, leave in review, noted (item 16, P8) ----

export function approveAgain(ctx: CommandContext, rows: ChangeActionRows, changeId: Uuid, workspace: Workspace, contentAuthorId: Uuid): ActionResult {
  const got = openChange(rows, changeId, ["type_conflict", "business_key_changed", "rule_updated"]);
  if (!got.ok) return got;
  const mapping = got.change.mapping_id ? live(rows.mappings).find((m) => m.id === got.change.mapping_id) : undefined;
  if (!mapping) return { ok: false, error: notFound("mapping") };
  if (mapping.status !== "review") return refuse(NOT_IN_REVIEW);
  if (!canApproveAgain(rows, got.change)) return refuse(DOES_NOT_FIT);
  const refused = checkFourEyes(workspace, ctx.actorId, contentAuthorId);
  if (refused) return { ok: false, error: refused };
  const edits: Edit[] = [
    { kind: "update", table: "mapping", before: mapping, row: nextVersion(ctx, mapping, approvalColumns(ctx)) },
    ...settle(ctx, rows.changes, (c) => c.mapping_id === mapping.id && isMappingKind(c.kind), (c) => (c.id === changeId ? RESOLUTION.approved : SETTLED.approvedAgain)),
  ];
  return { ok: true, edits, resolution: RESOLUTION.approved, change: got.change };
}

export function leaveInReview(ctx: CommandContext, rows: ChangeActionRows, changeId: Uuid): ActionResult {
  const got = openChange(rows, changeId, ["type_conflict", "business_key_changed", "rule_updated"]);
  if (!got.ok) return got;
  if (!got.change.mapping_id) return { ok: false, error: notFound("mapping") };
  return { ok: true, edits: settle(ctx, [got.change], () => true, RESOLUTION.leftInReview), resolution: RESOLUTION.leftInReview, change: got.change };
}

/** A business key change with no mapping on the column: the modeller takes note (step 2; see the acceptance doc). */
export function noted(ctx: CommandContext, rows: ChangeActionRows, changeId: Uuid): ActionResult {
  const got = openChange(rows, changeId, ["business_key_changed"]);
  if (!got.ok) return got;
  if (got.change.mapping_id) return refuse(CHANGE_RESOLVED);
  return { ok: true, edits: settle(ctx, [got.change], () => true, RESOLUTION.noted), resolution: RESOLUTION.noted, change: got.change };
}

// ---- approve again all {n} (item 17, P9, Q11) ----

export interface BulkEntry {
  change: SourceChange;
  mapping: Mapping;
  attribute: string;
  /** The reason the import sent it back (`review_reason`), or the change's detail. */
  reason: string;
}

export interface BulkPlan {
  approve: BulkEntry[];
  /** “These don't fit the source yet: …”, each with why. */
  notFit: (BulkEntry & { why: string[] })[];
  /** Four-eyes: this person changed or imported them last. */
  refused: BulkEntry[];
}

/**
 * What “Approve again all” does for one import: its open mapping changes whose mapping is still in review. `authorOf`
 * gives a mapping's last content editor (`lastContentEditor`), read only when four-eyes is on.
 */
export function approveAllPlan(rows: ChangeActionRows, importId: Uuid, workspace: Workspace, actorId: Uuid, authorOf: (mappingId: Uuid) => Uuid): BulkPlan {
  const plan: BulkPlan = { approve: [], notFit: [], refused: [] };
  const seen = new Set<Uuid>();
  for (const change of rows.changes) {
    if (!isOpen(change) || change.source_import_id !== importId || !isMappingKind(change.kind) || !change.mapping_id || seen.has(change.mapping_id)) continue;
    const mapping = live(rows.mappings).find((m) => m.id === change.mapping_id);
    const attribute = mapping && rows.attributes.find((a) => a.id === mapping.attribute_id && a.deleted_at === null);
    if (!mapping || !attribute || mapping.status !== "review") continue;
    seen.add(mapping.id);
    const entry: BulkEntry = { change, mapping, attribute: attributeLabel(rows, attribute.id), reason: mapping.review_reason ?? change.detail };
    const fit = fitsSource(mapping, attribute, inputColumnsOf(mapping.id, rows.mappingInputs, rows.columns));
    if (!fit.fits) plan.notFit.push({ ...entry, why: fit.reasons });
    else if (checkFourEyes(workspace, actorId, authorOf(mapping.id))) plan.refused.push(entry);
    else plan.approve.push(entry);
  }
  return plan;
}

/** The approvals of a bulk plan: each mapping approved, its open mapping changes settled. */
export function approveAllEdits(ctx: CommandContext, rows: ChangeActionRows, plan: BulkPlan): Edit[] {
  const edits: Edit[] = [];
  for (const e of plan.approve) {
    edits.push({ kind: "update", table: "mapping", before: e.mapping, row: nextVersion(ctx, e.mapping, approvalColumns(ctx)) });
    edits.push(...settle(ctx, rows.changes, (c) => c.mapping_id === e.mapping.id && isMappingKind(c.kind), (c) => (c.id === e.change.id ? RESOLUTION.approved : SETTLED.approvedAgain)));
  }
  return edits;
}
