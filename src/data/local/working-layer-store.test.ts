// The local adapter for the working layer (slice 3a): labels, label links, project pins and notes in the demo data,
// their reads, the data model's rules (keys, unique name, exactly one target, the note checks and the one-canvas rule),
// and domain commands applied end to end, undo included.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildWriteSet, type CommandContext } from "@/domain/changes";
import { deleteEntity } from "@/domain/commands/entity";
import { addLabel, deleteLabel, setLabelPinned } from "@/domain/commands/label";
import { createNote } from "@/domain/commands/note";
import { revertChangeGroup } from "@/domain/commands/undo";
import { uuidv7 } from "@/domain/ids";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { DataStore } from "../ports";
import { seedDevData } from "./dev-data";
import { readDb } from "./file";
import { findViolation } from "./schema";
import { buildSeed, SEED_IDS } from "./seed";
import { seedId } from "./seed-model";
import { createLocalDataStore } from "./store";

let dir: string;
let file: string;
let store: DataStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-working-"));
  file = path.join(dir, "dev-db.json");
  await seedDevData(file);
  store = createLocalDataStore(file);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const RETAIL = SEED_IDS.wsRetailDwh;
const CANVAS = SEED_IDS.canvasCustomerOrders;
const id = (key: string) => seedId(RETAIL, key);
const ctxFor = (actorId: string): CommandContext => ({ actorId, now: new Date().toISOString(), newId: () => uuidv7() });

async function canvasState() {
  return {
    canvas: await store.canvases.get(RETAIL, CANVAS),
    items: await store.canvasItems.listOfCanvas(RETAIL, CANVAS),
    frames: await store.frames.listOfCanvas(RETAIL, CANVAS),
    notes: await store.notes.listOfCanvas(RETAIL, CANVAS),
  };
}

async function accessAs(userId: string): Promise<WorkspaceAccess> {
  return { workspace: (await store.workspaces.get(RETAIL))!, member: await store.workspaces.getMember(RETAIL, userId) };
}

describe("demo data (slice 3a, step 1)", () => {
  it("has CR-23 on Customer, two of its attributes and one mapping, and JIRA-481 on customers and one column", async () => {
    const labels = await store.labels.list(RETAIL);
    expect(labels.map((l) => l.name).sort()).toEqual(["CR-23", "JIRA-481"]);
    const links = await store.labels.listLinks(RETAIL);
    const of = (name: string) => links.filter((k) => k.label_id === labels.find((l) => l.name === name)!.id);
    expect(of("CR-23").map((k) => k.entity_id ?? k.attribute_id ?? k.mapping_id)).toEqual([
      id("entity:customer"),
      id("attribute:customer.email"),
      id("attribute:customer.segment_code"),
      id("mapping:webusers.email>customer.email"),
    ]);
    expect(of("JIRA-481").map((k) => k.source_table_id ?? k.source_column_id)).toEqual([id("table:customers"), id("column:customers.email_addr")]);
    expect(await store.labels.listPins(RETAIL)).toEqual([]);
  });

  it("has three notes on “Customer & orders”: a free one, one pinned to order_line, a resolved one", async () => {
    const notes = await store.notes.listOfCanvas(RETAIL, CANVAS);
    expect(notes).toHaveLength(3);
    expect(notes.filter((n) => !n.pin_canvas_item_id && !n.pin_frame_id)).toHaveLength(1);
    expect(notes.find((n) => n.pin_canvas_item_id === id(`card:${CANVAS}:table:ordline`))).toMatchObject({ status: "open", created_by: SEED_IDS.userPiotr });
    expect(notes.filter((n) => n.status === "resolved")).toMatchObject([{ resolved_by: SEED_IDS.userLukasz }]);
    expect(await store.notes.listOfCanvas(RETAIL, SEED_IDS.canvasOrderLines)).toEqual([]);
    // the other workspaces have none
    expect(await store.labels.list(SEED_IDS.wsSales)).toEqual([]);
    expect(await store.notes.list(SEED_IDS.wsSales)).toEqual([]);
  });
});

describe("the data model's rules", () => {
  const seed = () => buildSeed();

  it("refuses a second live label with the same name in another case, and a name_key that is not the lower-case name", () => {
    const db = seed();
    const twin = { ...db.label[0]!, id: uuidv7(), name: "cr-23" };
    expect(findViolation({ ...db, label: [...db.label, twin] })).toMatchObject({ kind: "unique", table: "label" });
    expect(findViolation({ ...db, label: [...db.label, { ...twin, deleted_at: twin.created_at }] })).toBeNull();
    expect(findViolation({ ...db, label: [{ ...db.label[0]!, name_key: "CR-23" }, ...db.label.slice(1)] })).toMatchObject({ kind: "check", table: "label" });
  });

  it("refuses a label link with no target or two targets", () => {
    const db = seed();
    const k = db.label_link[0]!;
    expect(findViolation({ ...db, label_link: [{ ...k, entity_id: null }] })).toMatchObject({ kind: "check", table: "label_link" });
    expect(findViolation({ ...db, label_link: [{ ...k, attribute_id: db.attribute[0]!.id }] })).toMatchObject({ kind: "check", table: "label_link" });
  });

  it("refuses notes that break the note checks", () => {
    const db = seed();
    const pinned = db.note.find((n) => n.pin_canvas_item_id)!;
    const free = db.note.find((n) => !n.pin_canvas_item_id)!;
    const frameId = uuidv7();
    const withFrame = { ...db, frame: [{ ...db.frame[0], id: frameId, workspace_id: RETAIL, canvas_id: CANVAS, name: "Area", kind: "free" as const, concept_id: null, source_system_id: null, color: "#7C8998", x: 0, y: 0, width: 400, height: 400, collapsed: false, version: 1, created_at: pinned.created_at, created_by: pinned.created_by, updated_at: pinned.created_at, updated_by: pinned.created_by, deleted_at: null }] };
    const bad = (patch: object, base = pinned) => findViolation({ ...withFrame, note: [{ ...base, ...patch }] });
    expect(bad({ pin_frame_id: frameId })).toMatchObject({ table: "note", detail: expect.stringContaining("note_one_pin_ck") });
    expect(bad({ frame_id: frameId })).toMatchObject({ table: "note", detail: expect.stringContaining("note_pinned_not_in_frame_ck") });
    expect(bad({ width: 600 })).toMatchObject({ table: "note", detail: expect.stringContaining("note_width_ck") });
    expect(bad({ color: "violet" })).toMatchObject({ table: "note", detail: expect.stringContaining("note_color_ck") });
    expect(bad({ status: "done" })).toMatchObject({ table: "note", detail: expect.stringContaining("note_status_ck") });
    expect(bad({ frame_id: frameId }, free)).toBeNull();
  });

  it("keeps a note on the canvas of its card and frame (the rule SQL cannot express)", () => {
    const db = seed();
    const pinned = db.note.find((n) => n.pin_canvas_item_id)!;
    expect(findViolation({ ...db, note: [{ ...pinned, canvas_id: SEED_IDS.canvasOrderLines }] })).toMatchObject({ table: "note", detail: expect.stringContaining("note_on_one_canvas") });
  });
});

describe("commands end to end", () => {
  it("adds a label by name in any case, pins it, and deleting it takes its links and pins; undo brings them back", async () => {
    const anna = SEED_IDS.userAnna;
    const access = await accessAs(anna);
    const model = await store.model.load(RETAIL);
    const state = async () => ({ ...model, labels: await store.labels.list(RETAIL), links: await store.labels.listLinks(RETAIL) });
    const added = addLabel(ctxFor(anna), access, await state(), { target: { kind: "attribute", id: id("attribute:customer.first_name") }, name: "cr 23" });
    if (!added.ok) throw new Error(added.error.message);
    expect(added.value).toMatchObject({ created: false, name: "CR-23" });
    expect(await store.apply(added.writeSet)).toEqual({ ok: true });

    const cr23 = (await store.labels.list(RETAIL)).find((l) => l.name === "CR-23")!;
    const pinned = setLabelPinned(ctxFor(anna), access, { project: await store.projects.get(RETAIL, SEED_IDS.projCustomer360), label: cr23, pins: [] }, { projectId: SEED_IDS.projCustomer360, labelId: cr23.id, pinned: true });
    if (!pinned.ok) throw new Error(pinned.error.message);
    expect(await store.apply(pinned.writeSet)).toEqual({ ok: true });
    expect(await store.labels.listPins(RETAIL)).toEqual([{ project_id: SEED_IDS.projCustomer360, label_id: cr23.id, workspace_id: RETAIL }]);

    const deleted = deleteLabel(ctxFor(anna), access, { label: cr23, links: await store.labels.listLinks(RETAIL), pins: await store.labels.listPins(RETAIL) }, { labelId: cr23.id, expectedVersion: 1 });
    if (!deleted.ok) throw new Error(deleted.error.message);
    expect(deleted.value).toEqual({ name: "CR-23", items: 5 });
    expect(await store.apply(deleted.writeSet)).toEqual({ ok: true });
    expect((await store.labels.list(RETAIL)).map((l) => l.name)).toEqual(["JIRA-481"]);
    expect(await store.labels.listLinks(RETAIL)).toHaveLength(2);
    expect(await store.labels.listPins(RETAIL)).toEqual([]);

    const undone = revertChangeGroup(ctxFor(anna), access, { events: deleted.writeSet.events, rows: await store.model.loadForUndo(RETAIL) }, "undo");
    if (!undone.ok) throw new Error(undone.error.message);
    expect(await store.apply(undone.writeSet)).toEqual({ ok: true });
    expect(await store.labels.listLinks(RETAIL)).toHaveLength(7);
    expect(await store.labels.listPins(RETAIL)).toHaveLength(1);
  });

  it("refuses a second label with the same name made meanwhile (the unique index), writing nothing", async () => {
    const anna = SEED_IDS.userAnna;
    const access = await accessAs(anna);
    const model = await store.model.load(RETAIL);
    const state = { ...model, labels: await store.labels.list(RETAIL), links: await store.labels.listLinks(RETAIL) };
    const first = addLabel(ctxFor(anna), access, state, { target: { kind: "entity", id: id("entity:order") }, name: "New-1" });
    const second = addLabel(ctxFor(anna), access, state, { target: { kind: "entity", id: id("entity:line") }, name: "new-1" });
    if (!first.ok || !second.ok) throw new Error("expected both to pass the domain");
    expect(await store.apply(first.writeSet)).toEqual({ ok: true });
    expect(await store.apply(second.writeSet)).toMatchObject({ ok: false, error: { code: "conflict" } });
    expect((await store.labels.list(RETAIL)).filter((l) => l.name_key === "new-1")).toHaveLength(1);
  });

  it("deleting Customer soft-deletes the label links on it, its attributes and mappings, and frees its note (S3A-12)", async () => {
    const lukasz = SEED_IDS.userLukasz;
    const access = await accessAs(lukasz);
    // a note pinned to Customer's card at (496, 40), to the right of it: (280, 0)
    const pinned = createNote(ctxFor(lukasz), access, await canvasState(), { canvasId: CANVAS, text: "Ask about the key", pin: { canvasItemId: id(`card:${CANVAS}:entity:customer`) } });
    if (!pinned.ok) throw new Error(pinned.error.message);
    expect(await store.apply(pinned.writeSet)).toEqual({ ok: true });
    const noteId = pinned.value.note.id;
    const model = await store.model.load(RETAIL);
    const [canvasItems, labelLinks, notes] = await Promise.all([store.canvasItems.list(RETAIL), store.labels.listLinks(RETAIL), store.notes.list(RETAIL)]);
    const customer = model.entities.find((e) => e.name === "Customer")!;
    const r = deleteEntity(ctxFor(lukasz), access, { ...model, entity: customer, canvasItems, labelLinks, notes }, { entityId: customer.id, expectedVersion: 1 });
    if (!r.ok) throw new Error(r.error.message);
    expect(await store.apply(r.writeSet)).toEqual({ ok: true });
    // CR-23 marked nothing else; JIRA-481 marks a table and a column, which stay
    expect((await store.labels.listLinks(RETAIL)).map((k) => k.source_table_id ?? k.source_column_id)).toEqual([id("table:customers"), id("column:customers.email_addr")]);
    expect((await store.labels.list(RETAIL)).map((l) => l.name).sort()).toEqual(["CR-23", "JIRA-481"]);
    const freed = (await store.notes.listOfCanvas(RETAIL, CANVAS)).find((n) => n.id === noteId)!;
    expect(freed).toMatchObject({ pin_canvas_item_id: null, x: 776, y: 40, frame_id: null });

    const undone = revertChangeGroup(ctxFor(lukasz), access, { events: r.writeSet.events, rows: await store.model.loadForUndo(RETAIL) }, "undo");
    if (!undone.ok) throw new Error(undone.error.message);
    expect(await store.apply(undone.writeSet)).toEqual({ ok: true });
    expect(await store.labels.listLinks(RETAIL)).toHaveLength(6);
    expect((await store.notes.get(RETAIL, noteId))!.pin_canvas_item_id).toBe(id(`card:${CANVAS}:entity:customer`));
  });

  it("creates a note as a reviewer and refuses a write that puts a note on another canvas's card", async () => {
    const piotr = SEED_IDS.userPiotr;
    const access = await accessAs(piotr);
    const state = {
      canvas: await store.canvases.get(RETAIL, CANVAS),
      items: await store.canvasItems.listOfCanvas(RETAIL, CANVAS),
      frames: await store.frames.listOfCanvas(RETAIL, CANVAS),
      notes: await store.notes.listOfCanvas(RETAIL, CANVAS),
    };
    const r = createNote(ctxFor(piotr), access, state, { canvasId: CANVAS, text: "Which status codes does ERP use?", pin: { canvasItemId: id(`card:${CANVAS}:table:ordhdr`) } });
    if (!r.ok) throw new Error(r.error.message);
    expect(await store.apply(r.writeSet)).toEqual({ ok: true });
    expect(await store.notes.listOfCanvas(RETAIL, CANVAS)).toHaveLength(4);

    const elsewhere = { ...r.value.note, id: uuidv7(), pin_canvas_item_id: id(`card:${SEED_IDS.canvasOrderLines}:table:ordline`) };
    const ws = buildWriteSet(ctxFor(piotr), RETAIL, [{ kind: "insert", table: "note", row: elsewhere }]);
    expect(await store.apply(ws)).toMatchObject({ ok: false, error: { code: "invalid" } });
  });
});

describe("file format", () => {
  it("reads a slice 2b to 2c file (format 3) as one without labels and notes", async () => {
    const old: Record<string, unknown> = { ...(await readDb(file)), format: 3 };
    for (const t of ["label", "label_link", "project_pinned_label", "note"]) delete old[t];
    await writeFile(file, JSON.stringify(old), "utf8");
    expect(await store.labels.list(RETAIL)).toEqual([]);
    expect(await store.notes.list(RETAIL)).toEqual([]);
    expect((await readDb(file)).format).toBe(4);
  });
});
