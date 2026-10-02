// What a command hands to the data layer: the rows to write and their change_event records,
// all under one change_group_id (AD-13). The adapter applies a write set completely or not at all.

import type { DomainError } from "./errors";
import type { Uuid } from "./ids";
import type { ChangeEvent, ChangeOperation, RowImage, Timestamp, WritableRows, WritableTable } from "./types";

/** Supplied by the caller so commands stay pure: who acts, the clock and the id generator. */
export interface CommandContext {
  actorId: Uuid;
  now: Timestamp;
  newId: () => Uuid;
}

type InsertOf<T extends WritableTable> = { kind: "insert"; table: T; row: WritableRows[T] };
/** `before` is the row as the command read it; the adapter refuses the write if the stored row differs in version. */
type UpdateOf<T extends WritableTable> = { kind: "update"; table: T; before: WritableRows[T]; row: WritableRows[T] };

export type Write =
  | { [T in WritableTable]: InsertOf<T> }[WritableTable]
  | { [T in WritableTable]: UpdateOf<T> }[WritableTable]
  /** Link rows without deleted_at (project_canvas) are removed, not soft-deleted. */
  | { kind: "remove"; table: "project_canvas"; before: WritableRows["project_canvas"] };

export interface WriteSet {
  changeGroupId: Uuid;
  writes: Write[];
  events: ChangeEvent[];
}

export type CommandResult<T = undefined> =
  | { ok: true; value: T; writeSet: WriteSet }
  | { ok: false; error: DomainError };

export const fail = (error: DomainError): { ok: false; error: DomainError } => ({ ok: false, error });

/**
 * The object a change event is about. Tables with an `id` use it; link tables without one use the
 * key that names the moved thing: the canvas for project_canvas, the user for workspace_member.
 */
function objectId(write: Write): Uuid {
  switch (write.table) {
    case "project_canvas":
      return write.kind === "insert" ? write.row.canvas_id : write.before.canvas_id;
    case "workspace_member":
      return write.kind === "insert" ? write.row.user_id : write.before.user_id;
    default:
      return write.kind === "insert" ? write.row.id : write.before.id;
  }
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
  const events: ChangeEvent[] = writes.map((write) => ({
    id: ctx.newId(),
    workspace_id: workspaceId,
    change_group_id: changeGroupId,
    occurred_at: ctx.now,
    user_id: ctx.actorId,
    object_type: write.table,
    object_id: objectId(write),
    operation: operation(write),
    before_image: write.kind === "insert" ? null : image(write.before),
    // A removed link row has no after state; the schema requires an image, so it is empty.
    after_image: write.kind === "remove" ? {} : image(write.row),
    context_label_id: null,
  }));
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
