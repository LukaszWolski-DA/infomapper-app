// The Postgres adapter (slice 29, Q1; writes since slice 30): every read of the 14 repositories and `snapshot`, with the local
// adapter's results for the same rows. One statement per table a call reads (F3, no read fix yet: DB7); the rules are
// the domain's (`workspace-model.ts`) and the shared row rules (`../rows.ts`, `../order.ts`), never copied. A call that
// reads several tables reads them in one read-only transaction. `apply` writes in one transaction (slice 30, `./write.ts`).
// Server only.

import type { Uuid } from "@/domain/ids";
import { MAPPING_LOG } from "@/domain/model/mapping-rules";
import {
  byTabOrder,
  liveLabelLinksOf,
  liveProjectCanvasesOf,
  liveProjectPinsOf,
  liveRequirementLinksOf,
  workspaceModelOf,
  workspacePeopleOf,
  workspaceSnapshotOf,
  type StoredRows,
} from "@/domain/model/workspace-model";
import { newestBaselineFirst } from "@/domain/baseline/names";
import type { Baseline, ModuleTable, WritableRows } from "@/domain/types";
import { shapedBaselineContent } from "../baselines";
import { catalogReadOf } from "../catalog";
import { CATALOG_WITH_DELETED, CATALOG_WORKSPACE_TABLES } from "@/domain/catalog/read";
import { catalogReadable, type CatalogRightsInput } from "@/domain/permissions";
import { CORE_SCHEMA } from "../local/schema";
import { newestImportFirst, oldestChangeFirst } from "../order";
import type { DataStore } from "../ports";
import type { AnyRow, StoreSchema } from "../rows";
import { getPool, readTransaction, type Queryable } from "./pool";
import { dropStep, historyState, nextStep } from "./undo-history";
import { applyWriteSet } from "./write";
import { readTable, workspaceRows } from "./tables";

/** The tables `model.load` reads (`workspaceModelOf`); `entity` and `attribute` with their deleted rows (lost originals). */
const MODEL_TABLES = [
  "concept",
  "entity",
  "attribute",
  "attribute_input",
  "relationship",
  "source_system",
  "source_table",
  "source_column",
  "source_relationship",
  "source_relationship_column",
  "classification",
  "classification_link",
  "stereotype",
  "mapping",
  "mapping_input",
] as const;
/** Read with their deleted rows: the lost originals' names, and the removed classifications and stereotypes. */
const WITH_DELETED = new Set<string>(["entity", "attribute", "classification", "stereotype"]);
/** The live targets a requirement or label link may point to (the links' guards). */
const LINK_TARGETS = ["entity", "attribute", "mapping", "source_table", "source_column"] as const;

type Rows = Record<string, AnyRow[]>;
const asStored = (rows: Rows): StoredRows => rows as unknown as StoredRows;
const one = <T>(rows: AnyRow[]): T | null => (rows[0] as T | undefined) ?? null;

export function createPostgresDataStore(schema: StoreSchema = CORE_SCHEMA): DataStore {
  const pool = getPool();
  const read = (table: string, where?: string, ...params: unknown[]) => readTable(pool, schema, table, { where, params });
  const ofWorkspace = (db: Queryable, table: string, workspaceId: Uuid, live: boolean) => workspaceRows(db, schema, table, workspaceId, live);

  /** Several tables of a workspace into one object of rows, in one transaction. */
  const tablesOf = async (db: Queryable, workspaceId: Uuid, tables: readonly string[], live: (table: string) => boolean): Promise<Rows> => {
    const rows: Rows = {};
    for (const table of tables) rows[table] = await ofWorkspace(db, table, workspaceId, live(table));
    return rows;
  };
  const inTransaction = <T>(work: (db: Queryable) => Promise<T>) => readTransaction(pool, work);

  /** A table's rows of several workspaces in one statement (slice 39, C1), deleted ones included unless `live`. */
  const ofWorkspaces = (db: Queryable, table: string, ids: readonly Uuid[], live: boolean) =>
    readTable(db, schema, table, { where: live ? "workspace_id = any($1::uuid[]) and deleted_at is null" : "workspace_id = any($1::uuid[])", params: [[...ids]] });

  /** What `catalogReadable` reads: the person's memberships and their organizations' licences and workspaces. */
  const catalogRights = async (db: Queryable, userId: Uuid, unlocked: ReadonlySet<Uuid>): Promise<CatalogRightsInput> => {
    const memberships = await readTable(db, schema, "organization_member", { where: "user_id = $1", params: [userId] });
    const orgIds = memberships.map((m) => (m as { organization_id: Uuid }).organization_id);
    const ofOrgs = (table: string) => readTable(db, schema, table, { where: "organization_id = any($1::uuid[])", params: [orgIds] });
    return {
      userId,
      unlocked,
      memberships: memberships as never,
      organizations: (await readTable(db, schema, "organization", { where: "id = any($1::uuid[])", params: [orgIds] })) as never,
      licences: (await ofOrgs("organization_licence")) as never,
      workspaces: (await ofOrgs("workspace")) as never,
      workspaceMembers: (await readTable(db, schema, "workspace_member", { where: "user_id = $1", params: [userId] })) as never,
    };
  };

  /** The live rows the link guards read: the link table, its owner table and the five targets. */
  const linkRows = (workspaceId: Uuid, owner: "requirement" | "label", links: "requirement_link" | "label_link") =>
    inTransaction((db) => tablesOf(db, workspaceId, [owner, links, ...LINK_TARGETS], () => true));

  /** The people the workspace's pages may name: its members and the authors of its change events (`workspacePeopleOf`). */
  const peopleRows = async (db: Queryable, workspaceId: Uuid): Promise<Rows> => {
    const members = await ofWorkspace(db, "workspace_member", workspaceId, false);
    const authors = (await db.query<{ user_id: Uuid }>("select distinct user_id from change_event where workspace_id = $1", [workspaceId])).rows.map((r) => ({
      workspace_id: workspaceId,
      user_id: r.user_id,
    }));
    const users = await readTable(db, schema, "app_user", {
      where: "id in (select user_id from workspace_member where workspace_id = $1 union select user_id from change_event where workspace_id = $1)",
      params: [workspaceId],
    });
    return { app_user: users, workspace_member: members, change_event: authors };
  };

  const moduleTable = (table: string) => {
    if (!schema.rules[table]) throw new Error(`The store does not know the table ${table}.`);
  };

  return {
    users: {
      list: async () => (await read("app_user")) as never,
      get: async (userId) => one(await read("app_user", "id = $1", userId)),
      getByEmail: async (email) => one(await read("app_user", "email = $1", email)),
      getByAuthUserId: async (authUserId) => one(await read("app_user", "auth_user_id = $1", authUserId)),
      getAuthUserId: async (userId) => ((await pool.query<{ auth_user_id: string | null }>("select auth_user_id from app_user where id = $1", [userId])).rows[0]?.auth_user_id ?? null),
      listForWorkspace: async (workspaceId) => inTransaction(async (db) => workspacePeopleOf(asStored(await peopleRows(db, workspaceId)), workspaceId)),
    },

    organizations: {
      get: async (organizationId) => one(await read("organization", "id = $1 and deleted_at is null", organizationId)),
      listForUser: async (userId) =>
        (await read(
          "organization",
          `deleted_at is null and (id in (select organization_id from organization_member where user_id = $1)
            or id in (select w.organization_id from workspace w join workspace_member m on m.workspace_id = w.id
                       where m.user_id = $1 and w.deleted_at is null))`,
          userId,
        )) as never,
      getMember: async (organizationId, userId) => one(await read("organization_member", "organization_id = $1 and user_id = $2", organizationId, userId)),
      listMembershipsOfUsers: async (userIds) => (userIds.length ? ((await read("organization_member", "user_id = any($1::uuid[])", [...userIds])) as never) : []),
      getAccess: async (organizationId) => one(await read("organization_access", "organization_id = $1", organizationId)),
      listLicences: async (organizationId) => (await read("organization_licence", "organization_id = $1 and deleted_at is null", organizationId)) as never,
    },

    // slice 35 (D-87): rows without their content (`STORE_ONLY_COLUMNS`); a content alone, one baseline at a time
    baselines: {
      list: async (workspaceId) => ((await ofWorkspace(pool, "baseline", workspaceId, true)) as never as Baseline[]).sort(newestBaselineFirst),
      listAll: async (workspaceId) => (await ofWorkspace(pool, "baseline", workspaceId, false)) as never,
      get: async (workspaceId, baselineId) => one(await read("baseline", "workspace_id = $1 and id = $2 and deleted_at is null", workspaceId, baselineId)),
      content: async (workspaceId, baselineId) => {
        const { rows } = await pool.query<{ snapshot: unknown; snapshot_schema: number }>(
          "select snapshot, snapshot_schema from baseline where workspace_id = $1 and id = $2 and deleted_at is null",
          [workspaceId, baselineId],
        );
        return rows[0] ? shapedBaselineContent(rows[0].snapshot, rows[0].snapshot_schema, schema) : null;
      },
    },

    // slice 39 (C1): the rights and the rows in one read-only transaction; the rows of every readable workspace in scope
    // with one statement per table (`workspace_id = any($1)`), never a workspace the person may not read
    catalog: {
      readable: async (userId, unlocked) => inTransaction(async (db) => catalogReadable(await catalogRights(db, userId, unlocked))),
      read: async (userId, unlocked, scope, tables) => {
        for (const table of tables) moduleTable(table);
        return inTransaction(async (db) => {
          const readable = catalogReadable(await catalogRights(db, userId, unlocked));
          const organization = readable.find((o) => o.id === scope.organizationId);
          const ids = organization?.workspaces.map((w) => w.id).filter((id) => scope.workspaceId === null || id === scope.workspaceId) ?? [];
          if (!ids.length) return catalogReadOf({}, readable, scope, {} as never);
          const rows: Rows = {
            workspace: await readTable(db, schema, "workspace", { where: "id = any($1::uuid[])", params: [ids] }),
            organization: await readTable(db, schema, "organization", { where: "id = $1", params: [scope.organizationId] }),
            app_user: await readTable(db, schema, "app_user", { where: "id in (select user_id from workspace_member where workspace_id = any($1::uuid[]))", params: [ids] }),
          };
          for (const table of CATALOG_WORKSPACE_TABLES) rows[table] = await ofWorkspaces(db, table, ids, !CATALOG_WITH_DELETED.has(table));
          const modules: Partial<Record<ModuleTable, unknown[]>> = {};
          for (const table of tables) modules[table] = await ofWorkspaces(db, table, ids, true);
          return catalogReadOf(rows, readable, scope, modules as never);
        });
      },
    },

    modules: {
      list: async (workspaceId, table) => {
        moduleTable(table);
        return (await ofWorkspace(pool, table, workspaceId, true)) as never;
      },
    },

    workspaces: {
      get: async (workspaceId) => one(await read("workspace", "id = $1 and deleted_at is null", workspaceId)),
      listForUser: async (userId) =>
        (await read("workspace", "deleted_at is null and id in (select workspace_id from workspace_member where user_id = $1)", userId)) as never,
      getMember: async (workspaceId, userId) => one(await read("workspace_member", "workspace_id = $1 and user_id = $2", workspaceId, userId)),
      listMembers: async (workspaceId) => (await ofWorkspace(pool, "workspace_member", workspaceId, false)) as never,
    },

    invitations: {
      listOpen: async (workspaceId) => (await read("invitation", "workspace_id = $1 and accepted_at is null and revoked_at is null", workspaceId)) as never,
      get: async (workspaceId, invitationId) => one(await read("invitation", "workspace_id = $1 and id = $2", workspaceId, invitationId)),
      getByTokenHash: async (tokenHash) => one(await read("invitation", "token_hash = $1", tokenHash)),
    },

    passwordResets: {
      getByTokenHash: async (tokenHash) => one(await read("password_reset", "token_hash = $1", tokenHash)),
      listOfUser: async (userId) => (await read("password_reset", "app_user_id = $1", userId)) as never,
    },

    projects: {
      get: async (workspaceId, projectId) => one(await read("project", "workspace_id = $1 and id = $2 and deleted_at is null", workspaceId, projectId)),
      list: async (workspaceId) => (await ofWorkspace(pool, "project", workspaceId, true)) as never,
    },

    canvases: {
      get: async (workspaceId, canvasId) => one(await read("canvas", "workspace_id = $1 and id = $2 and deleted_at is null", workspaceId, canvasId)),
      list: async (workspaceId) => (await ofWorkspace(pool, "canvas", workspaceId, true)) as never,
      listLinksOfProject: async (workspaceId, projectId) => {
        const rows = await inTransaction((db) => tablesOf(db, workspaceId, ["project", "canvas", "project_canvas"], (t) => t !== "project_canvas"));
        return liveProjectCanvasesOf(asStored(rows), workspaceId)
          .filter((l) => l.project_id === projectId)
          .sort(byTabOrder);
      },
      listLinksOfCanvas: async (workspaceId, canvasId) => {
        const rows = await inTransaction((db) => tablesOf(db, workspaceId, ["project", "canvas", "project_canvas"], (t) => t !== "project_canvas"));
        return liveProjectCanvasesOf(asStored(rows), workspaceId).filter((l) => l.canvas_id === canvasId);
      },
    },

    model: {
      load: async (workspaceId) =>
        workspaceModelOf(asStored(await inTransaction((db) => tablesOf(db, workspaceId, MODEL_TABLES, (t) => !WITH_DELETED.has(t)))), workspaceId),
      listImports: async (workspaceId, sourceSystemId) =>
        ((await read(
          "source_import",
          sourceSystemId === undefined ? "workspace_id = $1 and deleted_at is null" : "workspace_id = $1 and deleted_at is null and source_system_id = $2",
          ...(sourceSystemId === undefined ? [workspaceId] : [workspaceId, sourceSystemId]),
        )) as never as WritableRows["source_import"][]).sort(newestImportFirst),
      listChanges: async (workspaceId) => ((await ofWorkspace(pool, "source_change", workspaceId, true)) as never as WritableRows["source_change"][]).sort(oldestChangeFirst),
      loadForUndo: async (workspaceId) => (await inTransaction((db) => tablesOf(db, workspaceId, schema.undoable, () => false))) as never,
    },

    canvasItems: {
      get: async (workspaceId, canvasItemId) => one(await read("canvas_item", "workspace_id = $1 and id = $2 and deleted_at is null", workspaceId, canvasItemId)),
      list: async (workspaceId) => (await ofWorkspace(pool, "canvas_item", workspaceId, true)) as never,
      listOfCanvas: async (workspaceId, canvasId) => (await read("canvas_item", "workspace_id = $1 and canvas_id = $2 and deleted_at is null", workspaceId, canvasId)) as never,
    },

    frames: {
      list: async (workspaceId) => (await ofWorkspace(pool, "frame", workspaceId, true)) as never,
      listOfCanvas: async (workspaceId, canvasId) => (await read("frame", "workspace_id = $1 and canvas_id = $2 and deleted_at is null", workspaceId, canvasId)) as never,
    },

    labels: {
      list: async (workspaceId) => (await ofWorkspace(pool, "label", workspaceId, true)) as never,
      get: async (workspaceId, labelId) => one(await read("label", "workspace_id = $1 and id = $2 and deleted_at is null", workspaceId, labelId)),
      listLinks: async (workspaceId) => liveLabelLinksOf(asStored(await linkRows(workspaceId, "label", "label_link")), workspaceId),
      getLink: async (workspaceId, labelLinkId) =>
        liveLabelLinksOf(asStored(await linkRows(workspaceId, "label", "label_link")), workspaceId).find((k) => k.id === labelLinkId) ?? null,
      listPins: async (workspaceId) =>
        liveProjectPinsOf(asStored(await inTransaction((db) => tablesOf(db, workspaceId, ["label", "project", "project_pinned_label"], (t) => t !== "project_pinned_label"))), workspaceId),
    },

    notes: {
      list: async (workspaceId) =>
        (await read(
          "note",
          "workspace_id = $1 and deleted_at is null and canvas_id in (select id from canvas where workspace_id = $1 and deleted_at is null)",
          workspaceId,
        )) as never,
      listOfCanvas: async (workspaceId, canvasId) => (await read("note", "workspace_id = $1 and canvas_id = $2 and deleted_at is null", workspaceId, canvasId)) as never,
      get: async (workspaceId, noteId) => one(await read("note", "workspace_id = $1 and id = $2 and deleted_at is null", workspaceId, noteId)),
    },

    requirements: {
      list: async (workspaceId) => (await ofWorkspace(pool, "requirement", workspaceId, true)) as never,
      get: async (workspaceId, requirementId) => one(await read("requirement", "workspace_id = $1 and id = $2 and deleted_at is null", workspaceId, requirementId)),
      listLinks: async (workspaceId) => liveRequirementLinksOf(asStored(await linkRows(workspaceId, "requirement", "requirement_link")), workspaceId),
      getLink: async (workspaceId, requirementLinkId) =>
        liveRequirementLinksOf(asStored(await linkRows(workspaceId, "requirement", "requirement_link")), workspaceId).find((k) => k.id === requirementLinkId) ?? null,
    },

    changeEvents: {
      list: async (workspaceId) => (await ofWorkspace(pool, "change_event", workspaceId, false)) as never,
      listForMapping: async (workspaceId, mappingId, log = MAPPING_LOG) =>
        (await read(
          "change_event",
          `workspace_id = $1 and ((object_type = $2 and object_id = $3)
            or (object_type = $4 and coalesce(after_image, before_image) ->> 'mapping_id' = $3::text))`,
          workspaceId,
          log.mapping,
          mappingId,
          log.input,
        )) as never,
      listForRequirement: async (workspaceId, requirementId) =>
        (await read("change_event", "workspace_id = $1 and object_type = 'requirement' and object_id = $2", workspaceId, requirementId)) as never,
    },

    // slice 30 (DB4, Q4): the lasting history (`undo_step`); recorded, undone and redone only with a write (`apply`)
    undoHistory: {
      state: (workspaceId, userId) => historyState(pool, workspaceId, userId),
      next: (workspaceId, userId, mode) => nextStep(pool, schema, workspaceId, userId, mode),
      drop: (workspaceId, userId, mode, changeGroupId) => dropStep(pool, workspaceId, userId, mode, changeGroupId),
    },

    // slice 25 (F1), slice 29 (F3): one read-only transaction, so every table comes from one state of the data
    snapshot: async (workspaceId, tables) => {
      for (const table of tables) moduleTable(table);
      return inTransaction(async (db) => {
        const workspace = await readTable(db, schema, "workspace", { where: "id = $1", params: [workspaceId] });
        const organizationId = (workspace[0] as { organization_id?: Uuid } | undefined)?.organization_id;
        const organization = organizationId ? await readTable(db, schema, "organization", { where: "id = $1", params: [organizationId] }) : [];
        const rows: Rows = {
          workspace,
          organization,
          ...(await tablesOf(db, workspaceId, MODEL_TABLES, (t) => !WITH_DELETED.has(t))),
          ...(await tablesOf(db, workspaceId, ["requirement", "requirement_link", "project", "canvas", "project_canvas", "canvas_item", "frame", "label", "label_link"], (t) => t !== "project_canvas")),
          ...(await peopleRows(db, workspaceId)),
        };
        const modules: Partial<Record<ModuleTable, unknown[]>> = {};
        for (const table of tables) modules[table] = await ofWorkspace(db, table, workspaceId, true);
        return workspaceSnapshotOf(asStored(withEmpty(rows)), workspaceId, modules as { [K in (typeof tables)[number]]: WritableRows[K][] });
      });
    },

    // slice 30: the writes, in one transaction each (`./write.ts`)
    apply: (writeSet, options) => applyWriteSet(pool, schema, writeSet, options),
  };
}

/** Every table the domain's rules name, empty where nothing was read. */
function withEmpty(rows: Rows): Rows {
  const out: Rows = {};
  for (const table of Object.keys(CORE_SCHEMA.rules)) out[table] = rows[table] ?? [];
  out.change_event = rows.change_event ?? [];
  return out;
}
