// InfoDocumenter through the composition root and the local adapter (slice 25, step 2): its documents are written with
// their change event and never become an undo step; the adapter refuses what the database would (a baseline source in
// this slice, a broken recipe, an unknown author); the switch is on only with the licence and off at any time; one
// snapshot reads the model, the requirements, the cards and the modules' rows from one state of the file (F1), and
// `model.load` reads the model by the same rule; the registered section kinds join both modules (F8).

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORE_SCHEMA, UNDO_TABLES } from "@/compose";
import { DOCUMENT_SECTION_KINDS } from "@/compose/documents";
import { seedDevData } from "@/data/local/dev-data";
import { readDb, writeDb } from "@/data/local/file";
import { SEED_IDS } from "@/data/local/seed";
import { createLocalDataStore } from "@/data/local/store";
import type { DataStore } from "@/data/ports";
import type { CommandContext } from "@/domain/changes";
import { isUndoable } from "@/domain/commands/undo";
import { updateWorkspaceSettings } from "@/domain/commands/workspace";
import { sectionKinds } from "@/domain/document/sections";
import { uuidv7 } from "@/domain/ids";
import { workspaceModelOf } from "@/domain/model/workspace-model";
import type { WorkspaceAccess } from "@/domain/permissions";
import { CUBE_SECTION_TYPE } from "@/modules/infocube/domain/document-section";
import { createDocument, updateDocument } from "@/modules/infodocumenter/domain/commands";
import type { DocumentDefinition } from "@/modules/infodocumenter/domain/types";

let dir: string;
let file: string;
let store: DataStore;
const WS = SEED_IDS.wsRetailDwh;
const ctx = (actorId: string = SEED_IDS.userLukasz): CommandContext => ({ actorId, now: new Date().toISOString(), newId: () => uuidv7() });

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-infodoc-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file);
  store = createLocalDataStore(file, STORE_SCHEMA);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function accessOf(userId: string, workspaceId = WS): Promise<WorkspaceAccess> {
  return { workspace: (await store.workspaces.get(workspaceId))!, member: await store.workspaces.getMember(workspaceId, userId) };
}

/** InfoMate's licence and InfoDocumenter on in Retail Co – DWH, as test data (the seed has neither, F31). */
async function turnOn(): Promise<void> {
  const db = await readDb(file);
  const at = new Date().toISOString();
  const by = SEED_IDS.userLukasz;
  db.organization_licence.push({ id: uuidv7(), version: 1, created_at: at, created_by: by, updated_at: at, updated_by: by, deleted_at: null, organization_id: SEED_IDS.orgInfoMate, module: "infodoc" });
  for (const w of db.workspace) if (w.id === WS) w.infodoc = true;
  await writeDb(file, db);
}

async function created(userId: string, preset: "dictionary" | "s2t" | "blank" = "dictionary"): Promise<DocumentDefinition> {
  const r = createDocument(ctx(userId), await accessOf(userId), { workspaceId: WS, preset }, DOCUMENT_SECTION_KINDS);
  if (!r.ok) throw new Error(r.error.message);
  expect(await store.apply(r.writeSet)).toEqual({ ok: true });
  return r.value.document;
}

describe("documents in the local adapter", () => {
  it("stores a reader's document with its change event, outside the undo history", async () => {
    await turnOn();
    const d = await created(SEED_IDS.userKasia);
    expect(await store.modules.list(WS, "document_definition")).toEqual([d]);
    const events = (await store.changeEvents.list(WS)).filter((e) => e.object_type === "document_definition");
    expect(events).toEqual([expect.objectContaining({ object_id: d.id, operation: "create", user_id: SEED_IDS.userKasia })]);
    expect(isUndoable(events, UNDO_TABLES)).toBe(false);
    expect(Object.keys(await store.model.loadForUndo(WS))).not.toContain("document_definition");
  });

  it("refuses a stale save, a baseline source, a broken recipe and an unknown author", async () => {
    await turnOn();
    const d = await created(SEED_IDS.userAnna);
    const access = await accessOf(SEED_IDS.userAnna);
    const first = updateDocument(ctx(SEED_IDS.userAnna), access, d, { workspaceId: WS, documentId: d.id, expectedVersion: d.version, name: "First" }, DOCUMENT_SECTION_KINDS);
    const second = updateDocument(ctx(SEED_IDS.userAnna), access, d, { workspaceId: WS, documentId: d.id, expectedVersion: d.version, name: "Second" }, DOCUMENT_SECTION_KINDS);
    if (!first.ok || !second.ok) throw new Error("not built");
    expect(await store.apply(first.writeSet)).toEqual({ ok: true });
    expect(await store.apply(second.writeSet)).toMatchObject({ ok: false, error: { code: "stale_version" } });

    const insert = (row: Partial<DocumentDefinition>) => {
      const r = createDocument(ctx(SEED_IDS.userAnna), access, { workspaceId: WS, preset: "blank" }, DOCUMENT_SECTION_KINDS);
      if (!r.ok) throw new Error(r.error.message);
      const changed = { ...r.value.document, ...row };
      return store.apply({ ...r.writeSet, writes: [{ kind: "insert", table: "document_definition", row: changed }] });
    };
    expect(await insert({ source_kind: "baseline", baseline_id: uuidv7() })).toMatchObject({ ok: false, error: { message: expect.stringContaining("document_definition_source_ck") } });
    expect(await insert({ sections: {} as never })).toMatchObject({ ok: false, error: { message: expect.stringContaining("document_definition_recipe_ck") } });
    // slice 26: the style is part of the recipe
    expect(await insert({ style: [] as never })).toMatchObject({ ok: false, error: { message: expect.stringContaining("document_definition_recipe_ck") } });
    expect(await insert({ name: " padded " })).toMatchObject({ ok: false, error: { message: expect.stringContaining("document_definition_name_ck") } });
    expect(await insert({ author_id: uuidv7() })).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("reads a recipe stored before slice 26 with the style's defaults and Text's heading on its entry (F11); the file's format stays", async () => {
    await turnOn();
    const d = await created(SEED_IDS.userAnna);
    const db = await readDb(file);
    const format = (db as unknown as { format: number }).format;
    expect(format).toBe(17);
    const rows = (db as unknown as { document_definition: Record<string, unknown>[] }).document_definition;
    // the row as slice 25 stored it
    const old = rows.find((r) => r.id === d.id)!;
    delete old.style;
    old.sections = (old.sections as Record<string, unknown>[]).map((s) => ({
      id: s.id,
      type: s.type,
      on: s.on,
      options: s.type === "text" ? { heading: "Scope", ...(s.options as object) } : s.options,
    }));
    await writeDb(file, db);
    const fresh = createLocalDataStore(file, STORE_SCHEMA);
    const [read] = await fresh.modules.list(WS, "document_definition");
    expect(read!.style).toEqual({ ...d.style, language: null });
    expect(read!.sections.map((s) => [s.type, s.heading, s.newPage, "heading" in s.options])).toEqual(d.sections.map((s) => [s.type, s.type === "text" ? "Scope" : null, true, false]));
    // a read writes nothing: the file keeps its format and the old row until the next write
    const after = await readDb(file);
    expect((after as unknown as { format: number }).format).toBe(17);
    expect((after as unknown as { document_definition: Record<string, unknown>[] }).document_definition.find((r) => r.id === d.id)!.style).toBeUndefined();
  });

  it("keeps the documents while InfoDocumenter is off, and refuses to turn it on without the licence", async () => {
    const owner = await accessOf(SEED_IDS.userLukasz);
    const state = { licensed: false, organizationName: "InfoMate" };
    expect(updateWorkspaceSettings(ctx(), owner, { workspaceId: WS, expectedVersion: owner.workspace.version, infodoc: true }, undefined, state)).toMatchObject({
      ok: false,
      error: { code: "forbidden", message: "InfoMate has no InfoDocumenter licence." },
    });
    expect(updateWorkspaceSettings(ctx(), owner, { workspaceId: WS, expectedVersion: owner.workspace.version, infodoc: true })).toMatchObject({ ok: false, error: { code: "invalid" } });
    await turnOn();
    await created(SEED_IDS.userLukasz);
    const on = await accessOf(SEED_IDS.userLukasz);
    const off = updateWorkspaceSettings(ctx(), on, { workspaceId: WS, expectedVersion: on.workspace.version, infodoc: false }, undefined, { licensed: true, organizationName: "InfoMate" });
    if (!off.ok) throw new Error(off.error.message);
    expect(await store.apply(off.writeSet)).toEqual({ ok: true });
    expect((await store.workspaces.get(WS))!.infodoc).toBe(false);
    expect(await store.modules.list(WS, "document_definition")).toHaveLength(1);
    const modeler = await accessOf(SEED_IDS.userAnna);
    expect(updateWorkspaceSettings(ctx(SEED_IDS.userAnna), modeler, { workspaceId: WS, expectedVersion: modeler.workspace.version, infodoc: true }, undefined, { licensed: true, organizationName: "InfoMate" })).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
});

describe("one snapshot of a workspace (F1)", () => {
  it("reads the model as model.load does, with the requirements, the cards, the people and the modules' live rows", async () => {
    await turnOn();
    const d = await created(SEED_IDS.userLukasz);
    const snapshot = (await store.snapshot(WS, ["document_definition", "cube_entity"]))!;
    expect(snapshot.workspace.id).toBe(WS);
    expect(snapshot.organization?.id).toBe(SEED_IDS.orgInfoMate);
    expect(snapshot.model).toEqual(await store.model.load(WS));
    expect(snapshot.model).toEqual(workspaceModelOf(await readDb(file), WS));
    expect(snapshot.requirements).toEqual(await store.requirements.list(WS));
    expect(snapshot.requirementLinks).toEqual(await store.requirements.listLinks(WS));
    expect(snapshot.projects).toEqual(await store.projects.list(WS));
    expect(snapshot.canvasItems).toEqual(await store.canvasItems.list(WS));
    expect(snapshot.members).toEqual(await store.workspaces.listMembers(WS));
    expect(snapshot.people).toEqual(await store.users.listForWorkspace(WS));
    const projects = await store.projects.list(WS);
    const links = (await Promise.all(projects.map((p) => store.canvases.listLinksOfProject(WS, p.id)))).flat();
    expect([...snapshot.projectCanvases].sort((a, b) => (a.project_id + a.canvas_id).localeCompare(b.project_id + b.canvas_id))).toEqual(
      links.sort((a, b) => (a.project_id + a.canvas_id).localeCompare(b.project_id + b.canvas_id)),
    );
    expect(snapshot.modules).toEqual({ document_definition: [d], cube_entity: [] });
  });

  it("leaves out deleted rows and other workspaces' rows, says null for a workspace that is not there and throws on an unknown table", async () => {
    await turnOn();
    const kept = await created(SEED_IDS.userLukasz);
    const gone = await created(SEED_IDS.userLukasz, "blank");
    const db = await readDb(file);
    const rows = (db as unknown as { document_definition: DocumentDefinition[] }).document_definition;
    for (const r of rows) if (r.id === gone.id) r.deleted_at = new Date().toISOString();
    rows.push({ ...kept, id: uuidv7(), workspace_id: SEED_IDS.wsBankX });
    await writeDb(file, db);
    expect((await store.snapshot(WS, ["document_definition"]))!.modules.document_definition).toEqual([kept]);
    expect(await store.snapshot(uuidv7(), [])).toBeNull();
    await expect(createLocalDataStore(file).snapshot(WS, ["document_definition"])).rejects.toThrow("does not know the table document_definition");
  });
});

describe("the registered section kinds (F8)", () => {
  it("joins InfoDocumenter's sections and InfoCube's two, once each (slice 26: every section without figures)", () => {
    expect([...DOCUMENT_SECTION_KINDS.keys()]).toEqual(["text", "overview", "dict", "s2t", "sources", "classreg", "reqs", "ready", "conv", "trace", "dq", CUBE_SECTION_TYPE, "cube.bus"]);
    const cube = DOCUMENT_SECTION_KINDS.get(CUBE_SECTION_TYPE)!;
    expect(cube.presets).toEqual(["s2t"]);
    expect(cube.options.safeParse(cube.defaults()).success).toBe(true);
    for (const k of DOCUMENT_SECTION_KINDS.values()) expect(k.options.safeParse(k.defaults()).success, k.type).toBe(true);
  });

  it("refuses a type registered twice or a name not in the stored shape", () => {
    const kind = DOCUMENT_SECTION_KINDS.get("text")!;
    expect(() => sectionKinds([kind, kind])).toThrow("registered twice");
    expect(() => sectionKinds([{ ...kind, type: "Cube Dim" }])).toThrow("not a valid name");
  });

  it("ends a new source-to-target document with the Dimensional model while InfoCube is on", async () => {
    const db = await readDb(file);
    for (const w of db.workspace) if (w.id === WS) w.infocube = true;
    await writeDb(file, db);
    await turnOn();
    // slice 26 (D2): the prototype's preset, the module's section in its place
    expect((await created(SEED_IDS.userLukasz, "s2t")).sections.map((s) => s.type)).toEqual(["conv", "s2t", "sources", CUBE_SECTION_TYPE, "dq"]);
  });
});
