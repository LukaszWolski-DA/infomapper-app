// The Sales star for development and slice 15's specs (slice 15a, O5) and what the composition root gives the pages
// from it (E6, E7, E13): it is consistent with the store's rules, it is added once, the plain e2e seed has none of it,
// and a canvas page's module view lists the star's roles, the Cube tab and its creates only while InfoCube is on.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { moduleEntityDependents, moduleView, STORE_SCHEMA } from "@/compose";
import { addModuleDemoData } from "@/compose/seed";
import { resetDevData } from "@/data/local/dev-data";
import { readDb, writeDb } from "@/data/local/file";
import { findViolation, type DevDb } from "@/data/local/schema";
import { buildSeed, SEED_IDS } from "@/data/local/seed";
import { createLocalDataStore } from "@/data/local/store";
import { starId } from "@/modules/infocube/data/sales-star";

const WS = SEED_IDS.wsRetailDwh;
const ACTIONS = { fact: async () => ({ ok: false as const, message: "" }), dimension: async () => ({ ok: false as const, message: "" }) };
const named = (db: DevDb, name: string) => db.entity.find((e) => e.workspace_id === WS && e.name === name)!;

describe("the Sales star (O5)", () => {
  it("is consistent with every rule of the store, InfoCube's included, and writes no change event", () => {
    const db = buildSeed();
    const events = db.change_event.length;
    expect(addModuleDemoData(db)).toBe(true);
    expect(findViolation(db, undefined, STORE_SCHEMA)).toBeNull();
    expect(db.change_event.length).toBe(events);
  });

  it("adds five dimensional entities with their roles, five relationships, the canvas, the licence and the switch, once", () => {
    const db = buildSeed() as DevDb & { cube_entity?: { entity_id: string; role: string; grain: string | null; scd_type: number | null }[] };
    addModuleDemoData(db);
    expect(addModuleDemoData(db)).toBe(false);
    const dims = db.entity.filter((e) => e.workspace_id === WS && e.model_level === "dimensional").map((e) => e.name);
    expect(dims).toEqual(["Fact Sales", "Dim Customer", "Dim Product", "Dim Date", "Fact Orders"]);
    expect(db.cube_entity!.map((c) => [db.entity.find((e) => e.id === c.entity_id)!.name, c.role, c.grain, c.scd_type])).toEqual([
      ["Fact Sales", "fact", "One order line", null],
      ["Dim Customer", "dimension", null, 2],
      ["Dim Product", "dimension", null, 1],
      ["Dim Date", "dimension", null, 0],
      ["Fact Orders", "fact", "One sales order", null],
    ]);
    const fact = named(db, "Fact Sales");
    // every dimension is the 1..1 end of its relationships to the facts (D-67)
    expect(db.relationship.filter((r) => r.to_entity_id === fact.id).map((r) => [db.entity.find((e) => e.id === r.from_entity_id)!.name, r.from_max, r.to_max])).toEqual([
      ["Dim Customer", "1", "n"],
      ["Dim Product", "1", "n"],
      ["Dim Date", "1", "n"],
    ]);
    const canvas = db.canvas.find((c) => c.name === "Sales star")!;
    expect(db.project_canvas.find((l) => l.canvas_id === canvas.id)?.project_id).toBe(SEED_IDS.projOrderManagement);
    expect(db.canvas_item.filter((i) => i.canvas_id === canvas.id)).toHaveLength(11);
    expect(db.organization_licence.map((l) => [l.organization_id, l.module])).toEqual([[SEED_IDS.orgInfoMate, "infocube"]]);
    expect(db.workspace.filter((w) => w.infocube).map((w) => w.id)).toEqual([WS]);
  });

  it("is not in the plain seed that every earlier spec starts from", () => {
    const db = buildSeed();
    expect(db.entity.some((e) => e.model_level === "dimensional")).toBe(false);
    expect(db.organization_licence).toEqual([]);
    expect(db.workspace.some((w) => w.infocube)).toBe(false);
  });
});

describe("the pages' module view from the star (E6, E7, E13)", () => {
  let dir: string;
  let file: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "im-star-"));
    file = path.join(dir, "db.json");
    await resetDevData(file, addModuleDemoData);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("gives every role, the Cube tab with facts then dimensions, and New fact and New dimension while on", async () => {
    const store = createLocalDataStore(file, STORE_SCHEMA);
    const [workspace, model] = await Promise.all([store.workspaces.get(WS), store.model.load(WS)]);
    const view = await moduleView(store, workspace!, model, ACTIONS);
    const db = await readDb(file);
    expect(view.roles[named(db, "Fact Sales").id]).toEqual({ text: "Fact", title: "A fact: one row per its grain (InfoCube)", card: "dimn fact", mark: "cube" });
    expect(view.roles[named(db, "Dim Date").id]).toMatchObject({ text: "Dimension", card: "dimn dimension" });
    expect(view.roles[named(db, "Customer").id]).toBeUndefined();
    expect(view.tabs.map((t) => [t.id, t.name, t.sections.map((s) => [s.title, s.entities.map((e) => e.meta)])])).toEqual([
      ["cube", "Cube", [["Facts", ["grain set", "grain set"]], ["Dimensions", ["SCD 2", "SCD 0", "SCD 1"]]]],
    ]);
    expect(view.creates.map((c) => [c.button, c.here])).toEqual([
      ["New fact", "New fact here"],
      ["New dimension", "New dimension here"],
    ]);
  });

  it("gives nothing for a workspace with InfoCube off and no facts or dimensions", async () => {
    const store = createLocalDataStore(file, STORE_SCHEMA);
    const [workspace, model] = await Promise.all([store.workspaces.get(SEED_IDS.wsBankX), store.model.load(SEED_IDS.wsBankX)]);
    expect(await moduleView(store, workspace!, model, ACTIONS)).toEqual({ roles: {}, tabs: [], creates: [] });
  });

  it("lists a dimension's own rows in its delete preview, each fact once (X-4)", async () => {
    // a second relationship between Dim Date and Fact Sales: the fact is still listed once
    const db = await readDb(file);
    const rel = db.relationship.find((r) => r.id === starId(WS, "relationship:date>sales"))!;
    db.relationship.push({ ...rel, id: starId(WS, "relationship:date>sales#2"), label: "ships" });
    await writeDb(file, db);
    const store = createLocalDataStore(file, STORE_SCHEMA);
    const model = await store.model.load(WS);
    expect(await moduleEntityDependents(store, WS, named(db, "Dim Date").id, model)).toEqual([
      ["Dimension", "SCD type 0 deleted"],
      ["2 facts", "lose this dimension: Fact Sales, Fact Orders"],
    ]);
    expect(await moduleEntityDependents(store, WS, named(db, "Fact Sales").id, model)).toEqual([["Fact", "its grain (“One order line”) deleted"]]);
    expect(await moduleEntityDependents(store, WS, named(db, "Customer").id, model)).toEqual([]);
  });
});
