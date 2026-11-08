// Module rows go with their parents (slice 15a, AD-23, E14, X-4): when a write soft-deletes a row that a module's row
// points to (InfoCube's `cube_entity` to an entity, `cube_measure` to an attribute), the module's row is soft-deleted in
// the same change group, so one undo brings everything back. The parents are the ones each module registered for undo
// (`UndoTables.parents`): one registration says both what a revert must find live and what a delete takes along.
// InfoMapper's own commands keep their cascades (`entityCascade`); this step only adds the modules' rows, after any
// command, so no InfoMapper command names a module table. Since slice 15c a module table may also go whole with a row
// that points to it (`goesWhole`, Q-5): a dimensional mapping goes when the cascade deletes one of its inputs because the
// input's logical attribute went; its other inputs then follow by `parents`. An input removed on purpose leaves it.
// Since slice 18 a module row may outlive a row it points to (`follows`, F16): when that row is deleted, the module's
// own rule changes it in the same change group (InfoCube: an approved lookup whose relationship goes is sent back to
// review), or leaves it; it keeps the id. InfoMapper never knows what the rule does.

import type { CommandContext, Write } from "../changes";
import type { UndoTables } from "./undo";
type Row = Record<string, unknown> & { id: string; version: number; deleted_at: string | null };
type Live = { deleted_at?: string | null };

/** The rows a write soft-deletes, by table: the parents a module's rows may point to. */
function deletedBy(writes: readonly Write[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const w of writes) {
    if (w.kind !== "update" || (w.before as Live).deleted_at !== null || (w.row as Live).deleted_at == null) continue;
    let ids = out.get(w.table);
    if (!ids) out.set(w.table, (ids = new Set()));
    ids.add(String((w.row as { id: unknown }).id));
  }
  return out;
}

/** The module tables whose rows can follow a write's deletes: those with a parent among the deleted rows' tables. */
export function cascadingModuleTables(writes: readonly Write[], tables: UndoTables): string[] {
  const deleted = deletedBy(writes);
  if (deleted.size === 0) return [];
  // a module's rows may point to another module row (15c's inputs to their mapping): follow until nothing is added
  const reach = new Set(deleted.keys());
  const out: string[] = [];
  const reached = (table: string) =>
    (tables.parents[table] ?? []).some(([, parent]) => reach.has(parent)) ||
    (tables.goesWhole[table] ?? []).some(([child]) => reach.has(child)) ||
    (tables.follows[table] ?? []).some(([, parent]) => reach.has(parent));
  for (let grew = true; grew; ) {
    grew = false;
    for (const table of tables.modules) {
      if (out.includes(table) || !reached(table)) continue;
      out.push(table);
      reach.add(table);
      grew = true;
    }
  }
  return out;
}

/**
 * The soft-deletes of every live module row whose parent the writes delete (or that the cascade itself deletes), not
 * already in the writes. `rows`: the workspace's live rows of the tables `cascadingModuleTables` named.
 */
export function moduleCascade(
  ctx: CommandContext,
  writes: readonly Write[],
  tables: UndoTables,
  rows: Readonly<Record<string, readonly unknown[]>>,
): Write[] {
  const deleted = deletedBy(writes);
  const written = new Set(writes.map((w) => `${w.table}:${String(((w.kind === "remove" ? w.before : w.row) as { id?: unknown }).id ?? "")}`));
  const extra: Write[] = [];
  // the rows this cascade deleted because a parent went, with the column of that parent (`goesWhole`'s `via`)
  const cascaded = new Map<string, Map<string, Set<string>>>();
  const takenWhole = (table: string, row: Row) =>
    (tables.goesWhole[table] ?? []).some(([child, column, via]) =>
      ((rows[child] ?? []) as Row[]).some((c) => String(c[column]) === row.id && cascaded.get(child)?.get(via)?.has(c.id)));
  for (let grew = true; grew; ) {
    grew = false;
    for (const table of tables.modules) {
      const parents = tables.parents[table] ?? [];
      for (const row of (rows[table] ?? []) as Row[]) {
        if (row.deleted_at !== null || written.has(`${table}:${row.id}`)) continue;
        const via = parents.filter(([column, parent]) => deleted.get(parent)?.has(String(row[column]))).map(([column]) => column);
        if (!via.length && !takenWhole(table, row)) continue;
        extra.push({ kind: "update", table, before: row, row: { ...row, deleted_at: ctx.now, version: row.version + 1, updated_at: ctx.now, updated_by: ctx.actorId } } as unknown as Write);
        written.add(`${table}:${row.id}`);
        let ids = deleted.get(table);
        if (!ids) deleted.set(table, (ids = new Set()));
        ids.add(row.id);
        let byColumn = cascaded.get(table);
        if (!byColumn) cascaded.set(table, (byColumn = new Map()));
        for (const column of via) {
          let set = byColumn.get(column);
          if (!set) byColumn.set(column, (set = new Set()));
          set.add(row.id);
        }
        grew = true;
      }
    }
  }
  // slice 18 (F16): the rows that outlive what was deleted, changed by their module's rule (each row once, after the
  // deletes, so a row this cascade deleted is not changed too)
  for (const table of tables.modules) {
    const follows = tables.follows[table];
    if (!follows) continue;
    for (const row of (rows[table] ?? []) as Row[]) {
      if (row.deleted_at !== null || written.has(`${table}:${row.id}`)) continue;
      let patch: Record<string, unknown> | null = null;
      for (const [column, parent, rule] of follows) {
        if (!deleted.get(parent)?.has(String(row[column]))) continue;
        const p = rule({ ...row, ...(patch ?? {}) });
        if (p) patch = { ...(patch ?? {}), ...p };
      }
      if (!patch) continue;
      extra.push({ kind: "update", table, before: row, row: { ...row, ...patch, version: row.version + 1, updated_at: ctx.now, updated_by: ctx.actorId } } as unknown as Write);
      written.add(`${table}:${row.id}`);
    }
  }
  return extra;
}
