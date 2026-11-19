// The lasting undo history on Postgres (slice 30, DB4, Q4): `undo_step`, one row per step of a person's two lists in a
// workspace, the last 50 of each. A step is recorded, undone or redone only in the transaction of its write (`apply`'s
// `history`, under the workspace's lock), so it survives a restart, a new deployment and several instances, and two
// writes cannot lose a step. A step's events are read from `change_event` by its change group (indexed), only for the
// step reverted next: the pages read the state only (F3). Rows leave the history by a hard delete (L3): the history is the
// store's bookkeeping, not model data (no version, no change event). Server only.

import type { PoolClient } from "pg";
import type { WriteSet } from "@/domain/changes";
import type { Uuid } from "@/domain/ids";
import { UNDO_LIMIT, type HistoryChange, type UndoState, type UndoStep } from "@/domain/model/undo-history";
import type { ChangeEvent, Timestamp } from "@/domain/types";
import type { StoreSchema } from "../rows";
import type { Queryable } from "./pool";
import { readTable } from "./tables";

/** A stored step (the schema check reads this interface: `POSTGRES_ONLY_TABLES`). */
export interface UndoStepRow {
  workspace_id: Uuid;
  user_id: Uuid;
  /** `undo` or `redo`. */
  list: string;
  /** Grows within a list; the step reverted next is the highest. */
  position: number;
  change_group_id: Uuid;
  /** The toasts' name of the step (`writeSet.label` or `changeLabel`; it cannot always be rebuilt from the events). */
  label: string;
  created_at: Timestamp;
}

/** The tables only the Postgres adapter has: outside the domain's tables, the local file and undo (the registry's class). */
export interface PostgresOnlyTables {
  undo_step: UndoStepRow[];
}
export const POSTGRES_ONLY_TABLES = ["undo_step"] as const;

type Mode = "undo" | "redo";
const other = (mode: Mode): Mode => (mode === "undo" ? "redo" : "undo");

/** Whether there is something to undo and to redo. */
export async function historyState(db: Queryable, workspaceId: Uuid, userId: Uuid): Promise<UndoState> {
  const { rows } = await db.query<{ list: string }>("select distinct list from undo_step where workspace_id = $1 and user_id = $2", [workspaceId, userId]);
  return { canUndo: rows.some((r) => r.list === "undo"), canRedo: rows.some((r) => r.list === "redo") };
}

/** The step reverted next, with its events in their stored order; a step whose change group is gone is dropped. */
export async function nextStep(db: Queryable, schema: StoreSchema, workspaceId: Uuid, userId: Uuid, mode: Mode): Promise<UndoStep | null> {
  for (;;) {
    const { rows } = await db.query<{ change_group_id: Uuid; label: string; position: number }>(
      "select change_group_id, label, position from undo_step where workspace_id = $1 and user_id = $2 and list = $3 order by position desc limit 1",
      [workspaceId, userId, mode],
    );
    const top = rows[0];
    if (!top) return null;
    const events = (await readTable(db, schema, "change_event", { where: "workspace_id = $1 and change_group_id = $2", params: [workspaceId, top.change_group_id] })) as unknown as ChangeEvent[];
    if (events.length) return { changeGroupId: top.change_group_id, label: top.label, events };
    await db.query("delete from undo_step where workspace_id = $1 and user_id = $2 and list = $3 and position = $4", [workspaceId, userId, mode, top.position]);
  }
}

/** Drops `changeGroupId` if it is still the next step of `mode` (one statement, so a second Ctrl+Z drops nothing else). */
export async function dropStep(db: Queryable, workspaceId: Uuid, userId: Uuid, mode: Mode, changeGroupId: Uuid): Promise<void> {
  await db.query(
    `delete from undo_step s where s.workspace_id = $1 and s.user_id = $2 and s.list = $3 and s.change_group_id = $4
        and s.position = (select max(position) from undo_step where workspace_id = $1 and user_id = $2 and list = $3)`,
    [workspaceId, userId, mode, changeGroupId],
  );
}

/** Puts a step on top of a list and keeps its last 50 (the oldest deleted). */
async function push(client: PoolClient, workspaceId: Uuid, userId: Uuid, list: Mode, changeGroupId: Uuid, label: string, at: Timestamp): Promise<void> {
  await client.query(
    `insert into undo_step (workspace_id, user_id, list, position, change_group_id, label, created_at)
     select $1, $2, $3, coalesce(max(position), 0) + 1, $4, $5, $6 from undo_step where workspace_id = $1 and user_id = $2 and list = $3`,
    [workspaceId, userId, list, changeGroupId, label, at],
  );
  await client.query(
    `delete from undo_step where workspace_id = $1 and user_id = $2 and list = $3
        and position <= (select max(position) from undo_step where workspace_id = $1 and user_id = $2 and list = $3) - $4`,
    [workspaceId, userId, list, UNDO_LIMIT],
  );
}

/** The history change of a write, in its transaction (the same rule as the local adapter's `withChange`). */
export async function changeHistory(client: PoolClient, writeSet: WriteSet, change: HistoryChange): Promise<void> {
  const workspaceId = writeSet.events[0]?.workspace_id;
  if (!workspaceId) return;
  const at = writeSet.events[0]!.occurred_at;
  if (change.kind === "record") {
    // a new step: what was undone before can no longer be redone
    await client.query("delete from undo_step where workspace_id = $1 and user_id = $2 and list = 'redo'", [workspaceId, change.userId]);
    await push(client, workspaceId, change.userId, "undo", writeSet.changeGroupId, change.label, at);
    return;
  }
  const from: Mode = change.kind === "undone" ? "undo" : "redo";
  // only while the reverted step is still the next one of its list (a second Ctrl+Z on its way changes nothing else)
  const { rows } = await client.query(
    `delete from undo_step s where s.workspace_id = $1 and s.user_id = $2 and s.list = $3 and s.change_group_id = $4
        and s.position = (select max(position) from undo_step where workspace_id = $1 and user_id = $2 and list = $3) returning 1`,
    [workspaceId, change.userId, from, change.stepGroupId],
  );
  if (rows.length) await push(client, workspaceId, change.userId, other(from), writeSet.changeGroupId, change.label, at);
}
