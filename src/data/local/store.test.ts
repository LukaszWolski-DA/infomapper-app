import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildWriteSet, type CommandContext, type WriteSet } from "@/domain/changes";
import { renameCanvas } from "@/domain/commands/canvas";
import { createProject } from "@/domain/commands/project";
import { updateWorkspaceSettings } from "@/domain/commands/workspace";
import { STALE_VERSION_MESSAGE } from "@/domain/errors";
import { isUuid, uuidv7 } from "@/domain/ids";
import { isGuest } from "@/domain/permissions";
import type { DataStore } from "../ports";
import { resetDevData, seedDevData } from "./dev-data";
import { readDb, readDbCached, writeDb } from "./file";
import { emptyDb, findViolation, keyOf, TABLES } from "./schema";
import { buildSeed, SEED_IDS, SEED_USERS } from "./seed";
import { createLocalDataStore } from "./store";

let dir: string;
let file: string;
let store: DataStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-store-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file);
  store = createLocalDataStore(file);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const ctxFor = (actorId: string): CommandContext => ({ actorId, now: new Date().toISOString(), newId: () => uuidv7() });

async function user(handle: keyof typeof SEED_USERS) {
  const u = (await store.users.list()).find((x) => x.email === SEED_USERS[handle].email);
  if (!u) throw new Error(handle);
  return u;
}

async function workspaceNamed(name: string) {
  const db = await readDb(file);
  const ws = db.workspace.find((w) => w.name === name);
  if (!ws) throw new Error(name);
  return ws;
}

async function accessOf(handle: keyof typeof SEED_USERS, workspaceName: string) {
  const u = await user(handle);
  const ws = await workspaceNamed(workspaceName);
  return { actor: u, access: { workspace: ws, member: await store.workspaces.getMember(ws.id, u.id) } };
}

describe("seed data (mirrors the prototype)", () => {
  it("has the organizations, workspaces and members of the PRD", async () => {
    const lukasz = await user("lukasz");
    expect((await store.organizations.listForUser(lukasz.id)).map((o) => o.name)).toEqual(["InfoMate", "Retail Co"]);
    expect((await store.workspaces.listForUser(lukasz.id)).map((w) => w.name)).toEqual([
      "Retail Co – DWH",
      "Bank X – Risk DWH",
      "Sales analytics",
    ]);

    const roles = async (name: string) => {
      const ws = await workspaceNamed(name);
      const users = await store.users.list();
      const orgMembers = await store.organizations.listMembershipsOfUsers(users.map((u) => u.id));
      return (await store.workspaces.listMembers(ws.id)).map((m) => {
        const u = users.find((x) => x.id === m.user_id)!;
        return `${u.display_name}: ${m.role}${isGuest(ws, u.id, orgMembers) ? " (guest)" : ""}`;
      });
    };
    expect(await roles("Retail Co – DWH")).toEqual([
      "Łukasz: owner",
      "Anna Nowak: modeler",
      "Piotr Wiśniewski: reviewer",
      "Kasia Zielińska: reader (guest)",
    ]);
    expect(await roles("Bank X – Risk DWH")).toEqual(["Łukasz: owner", "Anna Nowak: modeler"]);
    expect(await roles("Sales analytics")).toEqual(["Marek Lis: owner", "Łukasz: reviewer (guest)"]);

    const bank = await workspaceNamed("Bank X – Risk DWH");
    expect(bank).toMatchObject({ dv2_mode: true, four_eyes: true });
    expect(bank.archived_at).not.toBeNull();
  });

  it("shares “Customer & orders” between both Retail Co – DWH projects", async () => {
    const ws = await workspaceNamed("Retail Co – DWH");
    const canvases = await store.canvases.list(ws.id);
    const tabs = async (projectName: string) => {
      const p = (await store.projects.list(ws.id)).find((x) => x.name === projectName)!;
      return (await store.canvases.listLinksOfProject(ws.id, p.id)).map((l) => canvases.find((c) => c.id === l.canvas_id)!.name);
    };
    expect(await tabs("Customer 360")).toEqual(["Customer & orders"]);
    expect(await tabs("Order management")).toEqual(["Customer & orders", "Order lines & products"]);
  });

  it("makes Łukasz owner of InfoMate and Marek owner of Retail Co; everyone else is a member", async () => {
    const db = await readDb(file);
    const roles = db.organization_member.map((m) => {
      const org = db.organization.find((o) => o.id === m.organization_id)!.name;
      const name = db.app_user.find((u) => u.id === m.user_id)!.display_name;
      return `${org}: ${name} ${m.role}`;
    });
    expect(roles.sort()).toEqual([
      "InfoMate: Anna Nowak member",
      "InfoMate: Piotr Wiśniewski member",
      "InfoMate: Łukasz owner",
      "Retail Co: Kasia Zielińska member",
      "Retail Co: Marek Lis owner",
    ]);
  });

  it("uses fixed UUID v7 ids that survive a reset", async () => {
    expect(Object.values(SEED_IDS).every((id) => isUuid(id) && id[14] === "7")).toBe(true);
    expect(new Set(Object.values(SEED_IDS)).size).toBe(Object.values(SEED_IDS).length);

    const before = await readDb(file);
    await resetDevData(file);
    const after = await readDb(file);
    for (const table of TABLES) {
      expect(after[table].map((r) => keyOf(table, r as never))).toEqual(before[table].map((r) => keyOf(table, r as never)));
    }
    expect((await workspaceNamed("Retail Co – DWH")).id).toBe(SEED_IDS.wsRetailDwh);
  });

  it("has no change events and breaks no rule", async () => {
    const db = await readDb(file);
    expect(db.change_event).toEqual([]);
    expect(findViolation(db)).toBeNull();
  });

  it("does not overwrite existing data; reset wipes and seeds again", async () => {
    const { actor, access } = await accessOf("lukasz", "Retail Co – DWH");
    const r = createProject(ctxFor(actor.id), access, { workspaceId: access.workspace.id, name: "Finance" });
    if (!r.ok) throw new Error(r.error.message);
    expect(await store.apply(r.writeSet)).toEqual({ ok: true });

    expect(await seedDevData(file)).toBe("exists");
    expect((await store.projects.list(access.workspace.id)).map((p) => p.name)).toContain("Finance");

    await resetDevData(file);
    const ws = await workspaceNamed("Retail Co – DWH");
    expect((await store.projects.list(ws.id)).map((p) => p.name)).toEqual(["Customer 360", "Order management"]);
  });
});

describe("applying a write set", () => {
  it("writes the rows and their change events with one change group (S0-09)", async () => {
    const { actor, access } = await accessOf("lukasz", "Retail Co – DWH");
    const r = createProject(ctxFor(actor.id), access, { workspaceId: access.workspace.id, name: "Finance" });
    if (!r.ok) throw new Error(r.error.message);
    expect(await store.apply(r.writeSet)).toEqual({ ok: true });

    const project = await store.projects.get(access.workspace.id, r.value.projectId);
    expect(project?.name).toBe("Finance");
    const events = await store.changeEvents.list(access.workspace.id);
    expect(events).toHaveLength(3);
    expect(new Set(events.map((e) => e.change_group_id))).toEqual(new Set([r.writeSet.changeGroupId]));
    expect(events.every((e) => e.after_image !== null && e.user_id === actor.id)).toBe(true);
    expect(events[0]!.after_image).toEqual(project);
  });

  it("logs before and after images for an update", async () => {
    const { actor, access } = await accessOf("lukasz", "Retail Co – DWH");
    const r = updateWorkspaceSettings(ctxFor(actor.id), access, { workspaceId: access.workspace.id, expectedVersion: 1, name: "Retail DWH" });
    if (!r.ok) throw new Error(r.error.message);
    expect(await store.apply(r.writeSet)).toEqual({ ok: true });
    const [event] = await store.changeEvents.list(access.workspace.id);
    expect(event).toMatchObject({ operation: "update", before_image: { name: "Retail Co – DWH", version: 1 }, after_image: { name: "Retail DWH", version: 2 } });
    expect((await store.workspaces.get(access.workspace.id))?.version).toBe(2);
  });

  it("refuses a stale version and writes nothing (S0-08)", async () => {
    const first = await accessOf("lukasz", "Retail Co – DWH");
    const second = await accessOf("lukasz", "Retail Co – DWH"); // the same version 1, read in another session
    const a = updateWorkspaceSettings(ctxFor(first.actor.id), first.access, { workspaceId: first.access.workspace.id, expectedVersion: 1, name: "New name" });
    const b = updateWorkspaceSettings(ctxFor(second.actor.id), second.access, { workspaceId: second.access.workspace.id, expectedVersion: 1, name: "Other name" });
    if (!a.ok || !b.ok) throw new Error("commands should pass");

    expect(await store.apply(a.writeSet)).toEqual({ ok: true });
    const bytes = await readFile(file, "utf8");
    expect(await store.apply(b.writeSet)).toEqual({ ok: false, error: { code: "stale_version", message: STALE_VERSION_MESSAGE } });
    expect(await readFile(file, "utf8")).toBe(bytes);
    expect((await store.workspaces.get(first.access.workspace.id))?.name).toBe("New name");
    expect(await store.changeEvents.list(first.access.workspace.id)).toHaveLength(1);
  });

  it("serialises concurrent writes: of two writes from the same version, one wins", async () => {
    const { actor, access } = await accessOf("lukasz", "Retail Co – DWH");
    const sets = ["A", "B"].map((name) => {
      const r = updateWorkspaceSettings(ctxFor(actor.id), access, { workspaceId: access.workspace.id, expectedVersion: 1, name });
      if (!r.ok) throw new Error(r.error.message);
      return r.writeSet;
    });
    const results = await Promise.all(sets.map((s) => store.apply(s)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.error.code === "stale_version")).toHaveLength(1);
  });

  it("applies all or nothing: one failing row leaves the file untouched, events included", async () => {
    const { actor, access } = await accessOf("lukasz", "Retail Co – DWH");
    const r = createProject(ctxFor(actor.id), access, { workspaceId: access.workspace.id, name: "Finance" });
    if (!r.ok) throw new Error(r.error.message);
    const link = r.writeSet.writes[2]!;
    const broken: WriteSet = { ...r.writeSet, writes: [...r.writeSet.writes, link] }; // the same link twice
    const bytes = await readFile(file, "utf8");
    expect(await store.apply(broken)).toMatchObject({ ok: false, error: { code: "conflict" } });
    expect(await readFile(file, "utf8")).toBe(bytes);
  });

  it("rejects unknown ids", async () => {
    const { actor, access } = await accessOf("lukasz", "Retail Co – DWH");
    const ctx = ctxFor(actor.id);
    const ws = access.workspace;

    // updating a row that does not exist
    const ghost = { ...ws, id: uuidv7() };
    expect(await store.apply(buildWriteSet(ctx, ws.id, [{ kind: "update", table: "workspace", before: ghost, row: { ...ghost, version: 2 } }]))).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });

    // inserting a row that refers to an unknown workspace
    const project = { id: uuidv7(), workspace_id: uuidv7(), name: "P", description: null, version: 1, created_at: ctx.now, created_by: actor.id, updated_at: ctx.now, updated_by: actor.id, deleted_at: null };
    expect(await store.apply(buildWriteSet(ctx, ws.id, [{ kind: "insert", table: "project", row: project }]))).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });

    // removing a link that does not exist
    const link = { project_id: uuidv7(), canvas_id: uuidv7(), workspace_id: ws.id, sort_order: 0, added_at: ctx.now, added_by: actor.id };
    expect(await store.apply(buildWriteSet(ctx, ws.id, [{ kind: "remove", table: "project_canvas", before: link }]))).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
  });

  it("refuses a duplicate key", async () => {
    const { actor, access } = await accessOf("lukasz", "Retail Co – DWH");
    const [link] = await store.canvases.listLinksOfProject(access.workspace.id, (await store.projects.list(access.workspace.id))[0]!.id);
    expect(await store.apply(buildWriteSet(ctxFor(actor.id), access.workspace.id, [{ kind: "insert", table: "project_canvas", row: link! }]))).toMatchObject({
      ok: false,
      error: { code: "conflict" },
    });
  });

  it("removes a link row with a null after image", async () => {
    const { actor, access } = await accessOf("lukasz", "Retail Co – DWH");
    const ws = access.workspace.id;
    const shared = (await store.canvases.list(ws)).find((c) => c.name === "Customer & orders")!;
    const [link] = await store.canvases.listLinksOfCanvas(ws, shared.id);
    expect(await store.apply(buildWriteSet(ctxFor(actor.id), ws, [{ kind: "remove", table: "project_canvas", before: link! }]))).toEqual({ ok: true });
    expect(await store.canvases.listLinksOfCanvas(ws, shared.id)).toHaveLength(1);
    expect(await store.changeEvents.list(ws)).toMatchObject([{ operation: "delete", object_id: shared.id, before_image: link, after_image: null }]);
  });

  it("hides soft-deleted rows", async () => {
    const { actor, access } = await accessOf("lukasz", "Retail Co – DWH");
    const ws = access.workspace.id;
    const ctx = ctxFor(actor.id);
    const target = (await store.canvases.list(ws)).find((c) => c.name === "Order lines & products")!;
    const deleted = { ...target, deleted_at: ctx.now, version: target.version + 1 };
    expect(await store.apply(buildWriteSet(ctx, ws, [{ kind: "update", table: "canvas", before: target, row: deleted }]))).toEqual({ ok: true });

    expect(await store.canvases.get(ws, target.id)).toBeNull();
    expect((await store.canvases.list(ws)).map((c) => c.name)).toEqual(["Customer & orders"]);
    const orders = (await store.projects.list(ws)).find((p) => p.name === "Order management")!;
    expect(await store.canvases.listLinksOfProject(ws, orders.id)).toHaveLength(1);
    expect((await store.changeEvents.list(ws))[0]).toMatchObject({ operation: "delete" });
  });

  it("filters every read on the workspace", async () => {
    const retail = await workspaceNamed("Retail Co – DWH");
    const sales = await workspaceNamed("Sales analytics");
    const canvas = (await store.canvases.list(retail.id))[0]!;
    expect(await store.canvases.get(sales.id, canvas.id)).toBeNull();
    const project = (await store.projects.list(retail.id))[0]!;
    expect(await store.projects.get(sales.id, project.id)).toBeNull();
    expect(await store.canvases.listLinksOfProject(sales.id, project.id)).toEqual([]);
  });

  it("enforces CHECK constraints, e.g. a delete event without a before image", async () => {
    const { actor, access } = await accessOf("lukasz", "Retail Co – DWH");
    const r = renameCanvas(ctxFor(actor.id), access, { canvas: (await store.canvases.list(access.workspace.id))[0]! }, {
      canvasId: (await store.canvases.list(access.workspace.id))[0]!.id,
      expectedVersion: 1,
      name: "X",
    });
    if (!r.ok) throw new Error(r.error.message);
    const bad: WriteSet = { ...r.writeSet, events: r.writeSet.events.map((e) => ({ ...e, operation: "delete" as const, before_image: null })) };
    expect(await store.apply(bad)).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("leaves no temp files behind", async () => {
    const { actor, access } = await accessOf("lukasz", "Retail Co – DWH");
    const r = createProject(ctxFor(actor.id), access, { workspaceId: access.workspace.id, name: "Finance" });
    if (!r.ok) throw new Error(r.error.message);
    await store.apply(r.writeSet);
    expect(await readdir(dir)).toEqual(["dev-db.json"]);
  });
});

describe("undo (slice 1b)", () => {
  it("reads the undoable rows of a workspace with deleted ones", async () => {
    const { actor, access } = await accessOf("lukasz", "Retail Co – DWH");
    const ws = access.workspace.id;
    const ctx = ctxFor(actor.id);
    const target = (await store.canvases.list(ws)).find((c) => c.name === "Order lines & products")!;
    await store.apply(buildWriteSet(ctx, ws, [{ kind: "update", table: "canvas", before: target, row: { ...target, deleted_at: ctx.now, version: 2 } }]));
    const rows = await store.model.loadForUndo(ws);
    expect(rows.canvas.find((c) => c.id === target.id)?.deleted_at).toBe(ctx.now);
    expect([...rows.canvas, ...rows.entity, ...rows.canvas_item].every((r) => r.workspace_id === ws)).toBe(true);
  });

  it("keeps a history per person and workspace, and forgets steps whose data was replaced", async () => {
    const { actor, access } = await accessOf("lukasz", "Retail Co – DWH");
    const ws = access.workspace.id;
    const r = createProject(ctxFor(actor.id), access, { workspaceId: ws, name: "Finance" });
    if (!r.ok) throw new Error(r.error.message);
    await store.apply(r.writeSet);
    const step = { changeGroupId: r.writeSet.changeGroupId, label: "Create project", events: r.writeSet.events };
    await store.undoHistory.update(ws, actor.id, (h) => ({ ...h, undo: [...h.undo, step] }));
    expect((await store.undoHistory.get(ws, actor.id)).undo).toEqual([step]);
    expect((await store.undoHistory.get(ws, (await user("marek")).id)).undo).toEqual([]);

    await resetDevData(file);
    expect((await store.undoHistory.get(ws, actor.id)).undo).toEqual([]);
  });
});

describe("integrity rules", () => {
  it("refuses a duplicate e-mail (unique index) and an upper-case e-mail (CHECK)", () => {
    const db = buildSeed();
    const dup = { ...db, app_user: [...db.app_user, { ...db.app_user[0]!, id: uuidv7() }] };
    expect(findViolation(dup)).toMatchObject({ kind: "unique", table: "app_user" });
    const upper = { ...db, app_user: [{ ...db.app_user[0]!, email: "Lukasz@InfoMate.pl" }, ...db.app_user.slice(1)] };
    expect(findViolation(upper)).toMatchObject({ kind: "check", table: "app_user" });
  });

  it("refuses closed-list values outside the list", () => {
    const db = buildSeed();
    const bad = { ...db, workspace_member: [{ ...db.workspace_member[0]!, role: "superuser" as never }, ...db.workspace_member.slice(1)] };
    expect(findViolation(bad)).toMatchObject({ kind: "check", table: "workspace_member" });
  });
});

describe("reading from memory until the file changes (S1A-14)", () => {
  it("reuses the last read while the file is unchanged, and hands out a frozen copy", async () => {
    const first = await readDbCached(file);
    expect(await readDbCached(file)).toBe(first);
    expect(Object.isFrozen(first.workspace[0])).toBe(true);
    expect(() => (first.workspace as unknown[]).push({})).toThrow();
  });

  it("re-reads after a write by another process", async () => {
    const before = await readDbCached(file);
    const db = await readDb(file);
    db.workspace[0]!.name = "Renamed outside";
    await writeDb(file, db);
    const after = await readDbCached(file);
    expect(after).not.toBe(before);
    expect(after.workspace[0]!.name).toBe("Renamed outside");
  });

  it("sees its own writes", async () => {
    const { actor, access } = await accessOf("lukasz", "Retail Co – DWH");
    await store.projects.list(access.workspace.id);
    const r = createProject(ctxFor(actor.id), access, { workspaceId: access.workspace.id, name: "Finance" });
    if (!r.ok) throw new Error(r.error.message);
    expect(await store.apply(r.writeSet)).toEqual({ ok: true });
    expect((await store.projects.list(access.workspace.id)).map((p) => p.name)).toContain("Finance");
  });

  it("notices a removed file", async () => {
    await readDbCached(file);
    await rm(file);
    await expect(readDbCached(file)).rejects.toThrow(/npm run seed/);
  });
});

describe("development only (AD-29)", () => {
  it("refuses to load with NODE_ENV=production", async () => {
    const env = process.env as Record<string, string | undefined>;
    const before = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      expect(() => createLocalDataStore(file)).toThrow(/development only/);
      await expect(readDb(file)).rejects.toThrow(/development only/);
      await expect(writeDb(file, emptyDb())).rejects.toThrow(/development only/);
      await expect(seedDevData(path.join(dir, "other.json"))).rejects.toThrow(/development only/);
    } finally {
      env.NODE_ENV = before;
    }
  });

  it("says how to create the data when the file is missing", async () => {
    await expect(createLocalDataStore(path.join(dir, "missing.json")).users.list()).rejects.toThrow(/npm run seed/);
  });
});
