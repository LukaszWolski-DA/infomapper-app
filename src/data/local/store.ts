// The local JSON-file adapter (AD-29): implements the repositories on .data/dev-db.json.
// Development only. It enforces what the real database would: keys, unique indexes, foreign keys, CHECKs,
// plus version checks, and writes the rows and change events of one command together or not at all.

import type { Write, WriteSet } from "@/domain/changes";
import { domainError, notFound, staleVersion, type DomainError } from "@/domain/errors";
import type { Uuid } from "@/domain/ids";
import type { ProjectCanvas } from "@/domain/types";
import type { ApplyResult, DataStore } from "../ports";
import { assertNotProduction, readDb, writeDb } from "./file";
import { findViolation, keyOf, RULES, rowsOf, type AnyRow, type DevDb, type DevTable, type IntegrityViolation } from "./schema";

const live = <R extends { deleted_at: string | null }>(rows: R[]): R[] => rows.filter((r) => r.deleted_at === null);

const byTabOrder = (a: ProjectCanvas, b: ProjectCanvas) =>
  a.sort_order - b.sort_order || a.added_at.localeCompare(b.added_at);

// Writes are serialised per file within this process.
const queues = new Map<string, Promise<unknown>>();
function serialise<T>(file: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(file) ?? Promise.resolve();
  const next = previous.then(task, task);
  queues.set(file, next.catch(() => undefined));
  return next;
}

export function createLocalDataStore(file: string): DataStore {
  assertNotProduction();
  const load = () => readDb(file);

  /** Links whose project and canvas both still exist. */
  const liveLinks = (db: DevDb, workspaceId: Uuid) => {
    const projects = new Set(live(db.project).filter((p) => p.workspace_id === workspaceId).map((p) => p.id));
    const canvases = new Set(live(db.canvas).filter((c) => c.workspace_id === workspaceId).map((c) => c.id));
    return db.project_canvas.filter(
      (l) => l.workspace_id === workspaceId && projects.has(l.project_id) && canvases.has(l.canvas_id),
    );
  };

  return {
    users: {
      list: async () => (await load()).app_user,
      get: async (userId) => (await load()).app_user.find((u) => u.id === userId) ?? null,
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

    changeEvents: {
      list: async (workspaceId) => (await load()).change_event.filter((e) => e.workspace_id === workspaceId),
    },

    apply: (writeSet) => serialise(file, () => applyToFile(file, writeSet)),
  };
}

async function applyToFile(file: string, writeSet: WriteSet): Promise<ApplyResult> {
  const next = structuredClone(await readDb(file));
  for (const write of writeSet.writes) {
    const error = applyWrite(next, write);
    if (error) return { ok: false, error };
  }
  next.change_event.push(...structuredClone(writeSet.events));
  const violation = findViolation(next);
  if (violation) return { ok: false, error: violationError(violation) };
  await writeDb(file, next);
  return { ok: true };
}

function applyWrite(db: DevDb, write: Write): DomainError | null {
  // The model tables arrive in the local file with slice 1a, step 2; until then they are refused.
  if (!(write.table in RULES)) return domainError("invalid", `The local data store has no table ${write.table} yet.`);
  const table = write.table as DevTable;
  const rows = rowsOf(db, table);

  if (write.kind === "insert") {
    const row = write.row as unknown as AnyRow;
    const key = keyOf(table, row);
    if (rows.some((r) => keyOf(table, r) === key)) return domainError("conflict", "This already exists.");
    rows.push(structuredClone(row));
    return null;
  }

  const before = write.before as unknown as AnyRow;
  const key = keyOf(table, before);
  const index = rows.findIndex((r) => keyOf(table, r) === key);
  if (index === -1) return notFound("record");
  const stored = rows[index]!;

  if (write.kind === "remove") {
    rows.splice(index, 1);
    return null;
  }

  const row = write.row as unknown as AnyRow;
  if (keyOf(table, row) !== key) return domainError("invalid", "The key of a row cannot change.");
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
  }
}
