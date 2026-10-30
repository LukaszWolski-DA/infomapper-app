// What a command hands to the data layer: the rows to write and their change_event records,
// all under one change_group_id (AD-13). The adapter applies a write set completely or not at all.

import type { DomainError } from "./errors";
import type { Uuid } from "./ids";
import type { ChangeEvent, ChangeOperation, LinkTable, RowImage, Timestamp, WritableRows, WritableTable } from "./types";

/** Supplied by the caller so commands stay pure: who acts, the clock and the id generator. */
export interface CommandContext {
  actorId: Uuid;
  now: Timestamp;
  newId: () => Uuid;
}

type InsertOf<T extends WritableTable> = { kind: "insert"; table: T; row: WritableRows[T] };
/** `before` is the row as the command read it; the adapter refuses the write if the stored row differs in version. */
type UpdateOf<T extends WritableTable> = { kind: "update"; table: T; before: WritableRows[T]; row: WritableRows[T] };
type RemoveOf<T extends LinkTable> = { kind: "remove"; table: T; before: WritableRows[T] };

export type Write =
  | { [T in WritableTable]: InsertOf<T> }[WritableTable]
  | { [T in WritableTable]: UpdateOf<T> }[WritableTable]
  /** Link rows without deleted_at (project_canvas, project_pinned_label) are removed, not soft-deleted. */
  | { [T in LinkTable]: RemoveOf<T> }[LinkTable];

export interface WriteSet {
  changeGroupId: Uuid;
  writes: Write[];
  events: ChangeEvent[];
  /**
   * What the action was about when its writes say more (slice 3b, Q2): moving an attribute renumbers its neighbours,
   * but only the moved attribute gets the active context's label.
   */
  mainTargets?: { kind: "entity" | "attribute" | "mapping"; id: Uuid }[];
  /**
   * The working context labels nothing in this group (slice 7a, P9: an import, including the mappings it sends back to
   * review); its change events still record the context, as a layout change's do (D-26).
   */
  labelNothing?: boolean;
  /**
   * The undo history's name for the step when the change events cannot give it (slice 7c: a classification set on a
   * column names both, “Set Business key on cust_no”); otherwise `changeLabel` reads the events.
   */
  label?: string;
}

export type CommandResult<T = undefined> =
  | { ok: true; value: T; writeSet: WriteSet }
  | { ok: false; error: DomainError };

export const fail = (error: DomainError): { ok: false; error: DomainError } => ({ ok: false, error });

/**
 * The object a change event is about. Tables with an `id` use it; link tables without one use the
 * key that names the moved thing: the canvas for project_canvas, the label for project_pinned_label, the user for
 * workspace_member and organization_member, the organization for organization_access.
 */
function objectId(write: Write): Uuid {
  switch (write.table) {
    case "project_canvas":
      return write.kind === "insert" ? write.row.canvas_id : write.before.canvas_id;
    case "project_pinned_label":
      return write.kind === "insert" ? write.row.label_id : write.before.label_id;
    case "workspace_member":
    case "organization_member":
      return write.kind === "insert" ? write.row.user_id : write.before.user_id;
    case "organization_access":
      return write.kind === "insert" ? write.row.organization_id : write.before.organization_id;
    default:
      return write.kind === "insert" ? write.row.id : write.before.id;
  }
}

/**
 * Columns whose value never goes into a change event's images (slice 8, item 15, Q4): the images carry
 * `SECRET_CHANGED` or `SECRET_UNCHANGED` instead, so the history says that a password changed but never holds it.
 */
export const SECRET_COLUMNS: Partial<Record<WritableTable, readonly string[]>> = {
  organization_access: ["access_hash"],
};
export const SECRET_CHANGED = "(changed)";
export const SECRET_UNCHANGED = "(unchanged)";

function images(write: Write): { before: RowImage | null; after: RowImage | null } {
  const before = write.kind === "insert" ? null : image(write.before);
  // A removed link row has no after state (data model, change_event).
  const after = write.kind === "remove" ? null : image(write.row);
  for (const column of SECRET_COLUMNS[write.table] ?? []) {
    const changed = !before || !after || before[column] !== after[column];
    const marker = changed ? SECRET_CHANGED : SECRET_UNCHANGED;
    if (before) before[column] = marker;
    if (after) after[column] = marker;
  }
  return { before, after };
}

function operation(write: Write): ChangeOperation {
  if (write.kind === "insert") return "create";
  if (write.kind === "remove") return "delete";
  const wasDeleted = "deleted_at" in write.before && write.before.deleted_at !== null;
  const isDeleted = "deleted_at" in write.row && write.row.deleted_at !== null;
  if (!wasDeleted && isDeleted) return "delete";
  if (wasDeleted && !isDeleted) return "restore";
  return "update";
}

const image = (row: object): RowImage => structuredClone(row) as RowImage;

/** Builds the write set for one user action: one change event per written row, one change group. */
export function buildWriteSet(ctx: CommandContext, workspaceId: Uuid, writes: Write[]): WriteSet {
  const changeGroupId = ctx.newId();
  const events: ChangeEvent[] = writes.map((write) => {
    const { before, after } = images(write);
    return {
      id: ctx.newId(),
      workspace_id: workspaceId,
      change_group_id: changeGroupId,
      occurred_at: ctx.now,
      user_id: ctx.actorId,
      object_type: write.table,
      object_id: objectId(write),
      operation: operation(write),
      before_image: before,
      after_image: after,
      context_label_id: null,
    };
  });
  return { changeGroupId, writes, events };
}

/** The standard columns of a new versioned row. */
export function newRowColumns(ctx: CommandContext) {
  return {
    id: ctx.newId(),
    version: 1,
    created_at: ctx.now,
    created_by: ctx.actorId,
    updated_at: ctx.now,
    updated_by: ctx.actorId,
    deleted_at: null,
  };
}

/** The next version of a row: version + 1 and the updated_* columns. */
export function nextVersion<R extends { version: number; updated_at: Timestamp; updated_by: Uuid }>(
  ctx: CommandContext,
  row: R,
  patch: Partial<R>,
): R {
  return { ...row, ...patch, version: row.version + 1, updated_at: ctx.now, updated_by: ctx.actorId };
}

/**
 * The new version of every row a write set wrote, by id (link rows without an id or a version are left out). Undo
 * returns it (slice 9), and so do the writes that opt in (slice 10a, F2): the browser's next saves of those rows send it.
 */
export function writtenVersions(writes: readonly Write[]): Record<Uuid, number> {
  const out: Record<Uuid, number> = {};
  for (const w of writes) {
    if (!("row" in w)) continue;
    const row = w.row as { id?: unknown; version?: unknown };
    if (typeof row.id === "string" && typeof row.version === "number") out[row.id] = row.version;
  }
  return out;
}
