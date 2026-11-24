// The local JSON-file adapter (AD-29): implements the repositories on .data/dev-db.json.
// Development only. It enforces what the real database would: keys, unique indexes, foreign keys, CHECKs,
// plus version checks, and writes the rows and change events of one command together or not at all.

import { listedInvitations } from "@/domain/commands/invitations";
import type { Write, WriteSet } from "@/domain/changes";
import { accessChangedRefusal, type CheckedAccess } from "@/domain/commands/access-check";
import { countChecks, countRefusal } from "@/domain/commands/count-rules";
import { MAPPING_LOG } from "@/domain/model/mapping-rules";
import type { WorkspaceRows } from "@/domain/commands/undo";
import { domainError, notFound, staleVersion, type DomainError } from "@/domain/errors";
import type { Uuid } from "@/domain/ids";
import { dropNextRedo, dropNextUndo, emptyHistory, historyKey, nextRedo, nextUndo, stateOfHistory, withChange, type UndoHistory } from "@/domain/model/undo-history";
import { byTabOrder, liveLabelLinksOf, liveProjectCanvasesOf, liveProjectPinsOf, liveRequirementLinksOf, workspaceModelOf, workspacePeopleOf, workspaceSnapshotOf } from "@/domain/model/workspace-model";
import type { ModuleTable, WritableRows } from "@/domain/types";
import type { ApplyOptions, ApplyResult, DataStore } from "../ports";
import { newestImportFirst, oldestChangeFirst } from "../order";
import { assertNotProduction, readBaselineContent, readDbCached, readDbStamped, writeDb } from "./file";
import { shapedBaselineContent } from "../baselines";
import { snapshotWriteRefusal } from "@/domain/baseline/content";
import { newestBaselineFirst } from "@/domain/baseline/names";
import { CORE_SCHEMA, findViolation, keyOf, readRows, rowsOf, upgradeRows, type AnyRow, type DevDb, type IntegrityViolation, type LocalSchema, type StoreTable } from "./schema";

const live = <R extends { deleted_at: string | null }>(rows: R[]): R[] => rows.filter((r) => r.deleted_at === null);

// Writes are serialised per file within this process.
const queues = new Map<string, Promise<unknown>>();
function serialise<T>(file: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(file) ?? Promise.resolve();
  const next = previous.then(task, task);
  queues.set(file, next.catch(() => undefined));
  return next;
}

// Undo histories live in this process's memory (slice 1b), per data file, person and workspace. Kept on globalThis
// so a module reload in development does not empty them.
const histories: Map<string, UndoHistory> = ((globalThis as { __infomapperUndo?: Map<string, UndoHistory> }).__infomapperUndo ??= new Map());

/**
 * `schema`: the tables this store knows (slice 15a, AD-33). InfoMapper's alone by default; the application passes
 * `src/compose/tables.ts`'s, with the modules' tables. A write to a table it does not know is refused before anything is
 * written.
 */
export function createLocalDataStore(file: string, schema: LocalSchema = CORE_SCHEMA): DataStore {
  assertNotProduction();
  // slice 19 (F1): a module's older rows read in their current shape, before any read or check
  const load = async () => upgradeRows(await readDbCached(file), schema);

  /** Links whose project and canvas both still exist. */
  const liveLinks = (db: DevDb, workspaceId: Uuid) => liveProjectCanvasesOf(db, workspaceId);

  /** Live label links whose label and item are live too (slice 29, F1: the domain's rule, shared with Postgres). */
  const liveLabelLinks = (db: Readonly<DevDb>, workspaceId: Uuid) => liveLabelLinksOf(db, workspaceId);

  /** Live requirement links whose requirement and element are live too (the domain deletes links with their elements). */
  const liveRequirementLinks = (db: Readonly<DevDb>, workspaceId: Uuid) => liveRequirementLinksOf(db, workspaceId);

  /** The change groups in the workspace's log: a history step outside it belongs to data that was replaced. */
  const groupsOf = async (workspaceId: Uuid) =>
    new Set((await load()).change_event.filter((e) => e.workspace_id === workspaceId).map((e) => e.change_group_id));
  const withKnown = (h: UndoHistory, known: ReadonlySet<Uuid>): UndoHistory =>
    h.undo.every((s) => known.has(s.changeGroupId)) && h.redo.every((s) => known.has(s.changeGroupId))
      ? h
      : { undo: h.undo.filter((s) => known.has(s.changeGroupId)), redo: h.redo.filter((s) => known.has(s.changeGroupId)) };
  const current = async (workspaceId: Uuid, h: UndoHistory) => withKnown(h, await groupsOf(workspaceId));
  /** The person's history as it stands, without steps whose change group is gone. */
  const historyOf = async (workspaceId: Uuid, userId: Uuid) => {
    const key = `${file}|${historyKey(workspaceId, userId)}`;
    const fresh = await current(workspaceId, histories.get(key) ?? emptyHistory);
    histories.set(key, fresh);
    return fresh;
  };

  return {
    users: {
      list: async () => (await load()).app_user,
      get: async (userId) => (await load()).app_user.find((u) => u.id === userId) ?? null,
      getByEmail: async (email) => (await load()).app_user.find((u) => u.email === email) ?? null,
      // slice 29: the local adapter has no Supabase accounts
      getByAuthUserId: async () => null,
      getAuthUserId: async () => null,
      listForWorkspace: async (workspaceId) => workspacePeopleOf(await load(), workspaceId),
    },

    organizations: {
      get: async (organizationId) =>
        live((await load()).organization).find((o) => o.id === organizationId) ?? null,
      listForUser: async (userId) => {
        const db = await load();
        const orgIds = new Set(db.organization_member.filter((m) => m.user_id === userId).map((m) => m.organization_id));
        const wsIds = new Set(db.workspace_member.filter((m) => m.user_id === userId).map((m) => m.workspace_id));
        for (const w of live(db.workspace)) if (wsIds.has(w.id)) orgIds.add(w.organization_id);
        return live(db.organization).filter((o) => orgIds.has(o.id));
      },
      getMember: async (organizationId, userId) =>
        (await load()).organization_member.find((m) => m.organization_id === organizationId && m.user_id === userId) ??
        null,
      listMembershipsOfUsers: async (userIds) => {
        const wanted = new Set(userIds);
        return (await load()).organization_member.filter((m) => wanted.has(m.user_id));
      },
      getAccess: async (organizationId) =>
        (await load()).organization_access.find((a) => a.organization_id === organizationId) ?? null,
      listLicences: async (organizationId) => live((await load()).organization_licence).filter((l) => l.organization_id === organizationId),
    },

    // slice 35 (D-87): the rows from the data file, a content from its own file (`baselineFolder`)
    baselines: {
      list: async (workspaceId) => live((await load()).baseline.filter((b) => b.workspace_id === workspaceId)).sort(newestBaselineFirst),
      listAll: async (workspaceId) => (await load()).baseline.filter((b) => b.workspace_id === workspaceId),
      get: async (workspaceId, baselineId) => (await load()).baseline.find((b) => b.id === baselineId && b.workspace_id === workspaceId && b.deleted_at === null) ?? null,
      content: async (workspaceId, baselineId) => {
        const row = (await load()).baseline.find((b) => b.id === baselineId && b.workspace_id === workspaceId && b.deleted_at === null);
        if (!row) return null;
        const stored = await readBaselineContent(file, baselineId);
        return stored === null ? null : shapedBaselineContent(stored, row.snapshot_schema, schema);
      },
    },

    modules: {
      list: async (workspaceId, table) => {
        if (!schema.rules[table]) throw new Error(`The store does not know the table ${table}.`);
        const rows = readRows(await load(), table, schema) as unknown as { workspace_id: Uuid; deleted_at: string | null }[];
        return rows.filter((r) => r.workspace_id === workspaceId && r.deleted_at === null) as never;
      },
    },

    workspaces: {
      get: async (workspaceId) => live((await load()).workspace).find((w) => w.id === workspaceId) ?? null,
      listForUser: async (userId) => {
        const db = await load();
        const wsIds = new Set(db.workspace_member.filter((m) => m.user_id === userId).map((m) => m.workspace_id));
        return live(db.workspace).filter((w) => wsIds.has(w.id));
      },
      getMember: async (workspaceId, userId) =>
        (await load()).workspace_member.find((m) => m.workspace_id === workspaceId && m.user_id === userId) ?? null,
      listMembers: async (workspaceId) => (await load()).workspace_member.filter((m) => m.workspace_id === workspaceId),
    },

    invitations: {
      listOpen: async (workspaceId) => listedInvitations((await load()).invitation.filter((i) => i.workspace_id === workspaceId)),
      get: async (workspaceId, invitationId) => (await load()).invitation.find((i) => i.workspace_id === workspaceId && i.id === invitationId) ?? null,
      getByTokenHash: async (tokenHash) => (await load()).invitation.find((i) => i.token_hash === tokenHash) ?? null,
    },

    passwordResets: {
      getByTokenHash: async (tokenHash) => (await load()).password_reset.find((r) => r.token_hash === tokenHash) ?? null,
      listOfUser: async (userId) => (await load()).password_reset.filter((r) => r.app_user_id === userId),
    },

    projects: {
      get: async (workspaceId, projectId) =>
        live((await load()).project).find((p) => p.workspace_id === workspaceId && p.id === projectId) ?? null,
      list: async (workspaceId) => live((await load()).project).filter((p) => p.workspace_id === workspaceId),
    },

    canvases: {
      get: async (workspaceId, canvasId) =>
        live((await load()).canvas).find((c) => c.workspace_id === workspaceId && c.id === canvasId) ?? null,
      list: async (workspaceId) => live((await load()).canvas).filter((c) => c.workspace_id === workspaceId),
      listLinksOfProject: async (workspaceId, projectId) =>
        liveLinks(await load(), workspaceId)
          .filter((l) => l.project_id === projectId)
          .sort(byTabOrder),
      listLinksOfCanvas: async (workspaceId, canvasId) =>
        liveLinks(await load(), workspaceId).filter((l) => l.canvas_id === canvasId),
    },

    model: {
      // slice 25 (F1): the live filter, the orders and the lost originals are the domain's one rule
      load: async (workspaceId) => workspaceModelOf(await load(), workspaceId),
      listImports: async (workspaceId, sourceSystemId) =>
        live((await load()).source_import)
          .filter((i) => i.workspace_id === workspaceId && (sourceSystemId === undefined || i.source_system_id === sourceSystemId))
          .sort(newestImportFirst),
      listChanges: async (workspaceId) =>
        live((await load()).source_change)
          .filter((c) => c.workspace_id === workspaceId)
          .sort(oldestChangeFirst),
      loadForUndo: async (workspaceId) => {

        const db = await load();
        const rows = {} as Record<string, unknown[]>;
        for (const table of schema.undoable) rows[table] = readRows(db, table as StoreTable, schema).filter((r) => r.workspace_id === workspaceId);
        return rows as unknown as WorkspaceRows;
      },
    },

    canvasItems: {
      get: async (workspaceId, canvasItemId) =>
        live((await load()).canvas_item).find((i) => i.workspace_id === workspaceId && i.id === canvasItemId) ?? null,
      list: async (workspaceId) => live((await load()).canvas_item).filter((i) => i.workspace_id === workspaceId),
      listOfCanvas: async (workspaceId, canvasId) =>
        live((await load()).canvas_item).filter((i) => i.workspace_id === workspaceId && i.canvas_id === canvasId),
    },

    frames: {
      list: async (workspaceId) => live((await load()).frame).filter((f) => f.workspace_id === workspaceId),
      listOfCanvas: async (workspaceId, canvasId) =>
        live((await load()).frame).filter((f) => f.workspace_id === workspaceId && f.canvas_id === canvasId),
    },

    labels: {
      list: async (workspaceId) => live((await load()).label).filter((l) => l.workspace_id === workspaceId),
      get: async (workspaceId, labelId) =>
        live((await load()).label).find((l) => l.workspace_id === workspaceId && l.id === labelId) ?? null,
      listLinks: async (workspaceId) => liveLabelLinks(await load(), workspaceId),
      getLink: async (workspaceId, labelLinkId) => liveLabelLinks(await load(), workspaceId).find((k) => k.id === labelLinkId) ?? null,
      listPins: async (workspaceId) => liveProjectPinsOf(await load(), workspaceId),
    },

    notes: {
      list: async (workspaceId) => {
        const db = await load();
        const canvases = new Set(live(db.canvas).filter((c) => c.workspace_id === workspaceId).map((c) => c.id));
        return live(db.note).filter((n) => n.workspace_id === workspaceId && canvases.has(n.canvas_id));
      },
      listOfCanvas: async (workspaceId, canvasId) =>
        live((await load()).note).filter((n) => n.workspace_id === workspaceId && n.canvas_id === canvasId),
      get: async (workspaceId, noteId) => live((await load()).note).find((n) => n.workspace_id === workspaceId && n.id === noteId) ?? null,
    },

    requirements: {
      list: async (workspaceId) => live((await load()).requirement).filter((r) => r.workspace_id === workspaceId),
      get: async (workspaceId, requirementId) =>
        live((await load()).requirement).find((r) => r.workspace_id === workspaceId && r.id === requirementId) ?? null,
      listLinks: async (workspaceId) => liveRequirementLinks(await load(), workspaceId),
      getLink: async (workspaceId, requirementLinkId) => liveRequirementLinks(await load(), workspaceId).find((k) => k.id === requirementLinkId) ?? null,
    },

    changeEvents: {
      list: async (workspaceId) => (await load()).change_event.filter((e) => e.workspace_id === workspaceId),
      listForMapping: async (workspaceId, mappingId, log = MAPPING_LOG) =>
        (await load()).change_event.filter(
          (e) =>
            e.workspace_id === workspaceId &&
            ((e.object_type === log.mapping && e.object_id === mappingId) ||
              (e.object_type === log.input && (e.after_image ?? e.before_image)?.mapping_id === mappingId)),
        ),
      listForRequirement: async (workspaceId, requirementId) =>
        (await load()).change_event.filter((e) => e.workspace_id === workspaceId && e.object_type === "requirement" && e.object_id === requirementId),
    },

    // slice 30 (Q4 (a)): in this process's memory; a step is recorded, undone or redone only with its write (`apply`)
    undoHistory: {
      state: async (workspaceId, userId) => stateOfHistory(await historyOf(workspaceId, userId)),
      next: async (workspaceId, userId, mode) => {
        const h = await historyOf(workspaceId, userId);
        return (mode === "undo" ? nextUndo(h) : nextRedo(h)) ?? null;
      },
      drop: async (workspaceId, userId, mode, changeGroupId) => {
        const h = await historyOf(workspaceId, userId);
        // synchronous from the read on, so no other request changes the history in between
        const top = mode === "undo" ? nextUndo(h) : nextRedo(h);
        if (top?.changeGroupId === changeGroupId) histories.set(`${file}|${historyKey(workspaceId, userId)}`, mode === "undo" ? dropNextUndo(h) : dropNextRedo(h));
      },
    },

    // slice 25 (F1): one read of the file, so a write cannot fall between the model and the modules' rows
    snapshot: async (workspaceId, tables) => {
      const db = await load();
      const modules: Partial<Record<ModuleTable, unknown[]>> = {};
      for (const table of tables) {
        if (!schema.rules[table]) throw new Error(`The store does not know the table ${table}.`);
        modules[table] = readRows(db, table as StoreTable, schema);
      }
      return workspaceSnapshotOf(db, workspaceId, modules as { [K in (typeof tables)[number]]: WritableRows[K][] });
    },

    apply: (writeSet, options) => serialise(file, () => applyToFile(file, writeSet, schema, options)),
  };
}

/**
 * The write, from a read of the file to the file replaced (fix/write-after-reseed): when another process changed the file
 * between the two (the e2e reseed, a script, a hand edit), the write reads it again and is applied once more, so it is
 * checked against what is there now (a row changed meanwhile is a stale version) and the outside change is kept. A file
 * changed again during the second try is refused as a stale version.
 */
async function applyToFile(file: string, writeSet: WriteSet, schema: LocalSchema, options: ApplyOptions = {}): Promise<ApplyResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await applyOnce(file, writeSet, schema, options);
    if (result !== "changed") return result;
  }
  return { ok: false, error: staleVersion() };
}

async function applyOnce(file: string, writeSet: WriteSet, schema: LocalSchema, options: ApplyOptions): Promise<ApplyResult | "changed"> {
  const read = await readDbStamped(file);
  // Copy on write (slice 7a): the cached file is frozen, so only the tables this write touches get new arrays; their
  // written rows are new objects, every other row is shared with the cache.
  const current = upgradeRows(read.db, schema);
  // slice 30 (B3, L1): the access the command checked, read again before the rows
  if (options.access) {
    const changed = accessChangedRefusal(options.access, accessNow(current, options.access));
    if (changed) return { ok: false, error: changed };
  }
  const next = { ...current } as DevDb;
  const touched = new Set<StoreTable>(writeSet.writes.map((w) => w.table));
  // slice 15a: a table this store does not know is refused before anything is written, never skipped
  const unknown = [...touched].find((t) => !schema.rules[t]);
  if (unknown) return { ok: false, error: domainError("invalid", `The store does not know the table ${unknown}.`) };
  // slice 35 (F2): a baseline's content is written by its insert only
  const rewrite = snapshotWriteRefusal(writeSet.writes);
  if (rewrite) return { ok: false, error: domainError("invalid", rewrite) };
  const rowsOfNext = next as unknown as Record<StoreTable, unknown[]>;
  // a module's table may not be in the file yet: its first write starts it
  for (const table of touched) rowsOfNext[table] = [...((current as unknown as Record<string, readonly unknown[] | undefined>)[table] ?? [])];
  const index = new KeyIndex(next, schema);
  for (const write of writeSet.writes) {
    const error = applyWrite(next, index, write, schema);
    if (error) return { ok: false, error };
  }
  next.change_event = [...current.change_event, ...structuredClone(writeSet.events)];
  // The count rules (slice 30, F5, F6; the last owner since slice 8, the last project since 12a, InfoCube off since 15a):
  // what the command counted from the rows it read is counted again here, inside the serialised write, on the state
  // after it. One rule with the Postgres adapter (`countRefusal`).
  const counted = countRefusal(next, countChecks(writeSet.writes));
  if (counted) return { ok: false, error: counted };
  // only what this write can have broken: the touched tables and the new change events
  const violation = findViolation(next, { tables: touched, newEvents: writeSet.events.length }, schema);
  if (violation) return { ok: false, error: violationError(violation) };
  if (!(await writeDb(file, next, { ifUnchanged: read.stamp }))) return "changed";
  // slice 30 (F4): the history with its write, in the same serialised step
  if (options.history) {
    const workspaceId = writeSet.events[0]?.workspace_id;
    if (workspaceId) {
      const key = `${file}|${historyKey(workspaceId, options.history.userId)}`;
      const known = new Set(next.change_event.filter((e) => e.workspace_id === workspaceId).map((e) => e.change_group_id));
      const h = histories.get(key) ?? emptyHistory;
      const kept = { undo: h.undo.filter((s) => known.has(s.changeGroupId)), redo: h.redo.filter((s) => known.has(s.changeGroupId)) };
      histories.set(key, withChange(kept, options.history, writeSet));
    }
  }
  return { ok: true };
}

/** The actor's access as the file holds it now, for the parts the command read. */
function accessNow(db: DevDb, checked: CheckedAccess) {
  const ws = checked.workspace ? db.workspace.find((w) => w.id === checked.workspace!.id && w.deleted_at === null) : undefined;
  return {
    ...(checked.workspace
      ? {
          workspace: ws
            ? { archived: ws.archived_at !== null, role: db.workspace_member.find((m) => m.workspace_id === ws.id && m.user_id === checked.userId)?.role ?? null }
            : null,
        }
      : {}),
    ...(checked.organization
      ? { organization: { role: db.organization_member.find((m) => m.organization_id === checked.organization!.id && m.user_id === checked.userId)?.role ?? null } }
      : {}),
  };
}

/**
 * Where each row of a table is, by key, built the first time a write touches the table (slice 7a: an import writes tens
 * of thousands of rows; searching the table for each one was quadratic).
 */
class KeyIndex {
  private readonly tables = new Map<StoreTable, Map<string, number>>();
  constructor(
    private readonly db: DevDb,
    private readonly schema: LocalSchema,
  ) {}
  of(table: StoreTable): Map<string, number> {
    let index = this.tables.get(table);
    if (!index) {
      index = new Map(rowsOf(this.db, table).map((r, i) => [keyOf(table, r, this.schema), i]));
      this.tables.set(table, index);
    }
    return index;
  }
  /** After a row was removed from the middle: positions shift, so the table is indexed again on its next use. */
  drop(table: StoreTable): void {
    this.tables.delete(table);
  }
}

function applyWrite(db: DevDb, keys: KeyIndex, write: Write, schema: LocalSchema): DomainError | null {
  const table: StoreTable = write.table;
  const rows = rowsOf(db, table);
  const positions = keys.of(table);

  if (write.kind === "insert") {
    const row = write.row as unknown as AnyRow;
    const key = keyOf(table, row, schema);
    if (positions.has(key)) return domainError("conflict", "This already exists.");
    positions.set(key, rows.length);
    rows.push(structuredClone(row));
    return null;
  }

  const before = write.before as unknown as AnyRow;
  const key = keyOf(table, before, schema);
  const index = positions.get(key);
  if (index === undefined) return notFound("record");
  const stored = rows[index]!;

  if (write.kind === "remove") {
    rows.splice(index, 1);
    keys.drop(table);
    return null;
  }

  const row = write.row as unknown as AnyRow;
  if (keyOf(table, row, schema) !== key) return domainError("invalid", "The key of a row cannot change.");
  if ("version" in before) {
    if (stored.version !== before.version) return staleVersion();
    if (row.version !== (before.version as number) + 1) return domainError("invalid", "The new version must be the read version + 1.");
  } else if (JSON.stringify(stored) !== JSON.stringify(before)) {
    return staleVersion();
  }
  rows[index] = structuredClone(row);
  return null;
}

function violationError(v: IntegrityViolation): DomainError {
  switch (v.kind) {
    case "duplicate_key":
    case "unique":
      return domainError("conflict", `This already exists (${v.table}: ${v.detail}).`);
    case "foreign_key":
      return domainError("not_found", `This refers to something that does not exist (${v.table}: ${v.detail}).`);
    case "check":
      return domainError("invalid", `A data rule was broken (${v.detail}).`);
    case "unknown_table":
      return domainError("invalid", `The store does not know the table ${v.table}.`);
  }
}
