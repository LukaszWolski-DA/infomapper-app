// Slice 15c step 5: the panels' and the homes' reads of dimensional mappings, through the composition root on the
// Sales star. The proposed name of "Create dimension from this…" (numbered when taken), the Overview's "{n} of {m} fed" (P17, F19), the entity panel's list texts (C10),
// a header drop's undo name, and the homes' thumbnails: a dimensional card filtered to Mapped or Not mapped has the
// canvas's height (C12, the step 4 finding).

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { indexModel } from "@/app/_panels/model-index";
import { coverage } from "@/app/_panels/stats";
import { buildCards } from "@/canvas/card-data";
import { cardHeight, cardWidth } from "@/canvas/geometry";
import { moduleRowFeeds, moduleView, STORE_SCHEMA } from "@/compose";
import { addModuleDemoData } from "@/compose/seed";
import { resetDevData } from "@/data/local/dev-data";
import { readDb, writeDb } from "@/data/local/file";
import { SEED_IDS } from "@/data/local/seed";
import { createLocalDataStore } from "@/data/local/store";
import type { DataStore } from "@/data/ports";
import { canvasThumbnails, thumbnailIndex, type ThumbnailRect } from "@/domain/model/thumbnail";
import { proposedDimensionName } from "@/modules/infocube/domain/mappings";
import { FEED_WORDS } from "@/modules/infocube/domain/view";

const WS = SEED_IDS.wsRetailDwh;
const ACTIONS = { fact: async () => ({ ok: false as const, message: "" }), dimension: async () => ({ ok: false as const, message: "" }) };

let dir: string;
let file: string;
let store: DataStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-cube-panels-"));
  file = path.join(dir, "dev-db.json");
  await resetDevData(file);
  const db = await readDb(file);
  addModuleDemoData(db);
  await writeDb(file, db);
  store = createLocalDataStore(file, STORE_SCHEMA);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("Create dimension from this… (B-2): the proposed name", () => {
  it("is Dim {entity}, numbered while that is taken (Łukasz, 15c step 3)", () => {
    const taken = (names: string[]) => (n: string) => names.some((x) => x.toLowerCase() === n.toLowerCase());
    expect(proposedDimensionName("Product", taken([]))).toBe("Dim Product");
    expect(proposedDimensionName("Product", taken(["dim product"]))).toBe("Dim Product 2");
    expect(proposedDimensionName("Product", taken(["Dim Product", "Dim Product 2"]))).toBe("Dim Product 3");
  });
});

describe("the panels' feeds on the star", () => {
  it("the Overview counts a fact's or a dimension's feeds with its words, a logical entity's mappings as before", async () => {
    const [workspace, model] = await Promise.all([store.workspaces.get(WS), store.model.load(WS)]);
    const view = await moduleView(store, workspace!, model, ACTIONS);
    const ix = indexModel(model);
    const named = (name: string) => model.entities.find((e) => e.name === name && e.deleted_at === null)!.id;
    const rows = coverage(ix, [named("Dim Customer"), named("Dim Date"), named("Customer")], view);
    expect(rows.map((r) => [r.entity.name, r.mapped, r.attributes, r.feed?.word ?? null])).toEqual([
      ["Dim Customer", 4, 5, "fed"],
      ["Dim Date", 0, 5, "fed"],
      ["Customer", coverage(ix, [named("Customer")])[0]!.mapped, ix.attributesOf.get(named("Customer"))!.length, null],
    ]);
    expect(rows[0]!.feed).toEqual({ ...FEED_WORDS });
    // the entity panel's list: a fed row's input, "ƒ {n} attributes" for a transformation, nothing for an unfed one
    const attr = (entity: string, name: string) => model.attributes.find((a) => a.entity_id === named(entity) && a.name === name && a.deleted_at === null)!.id;
    expect(view.rowFeeds[attr("Dim Customer", "segment_code")]!.list).toBe("Customer.segment_code");
    expect(view.rowFeeds[attr("Fact Sales", "net_amount")]!.list).toBe("ƒ 3 attributes");
    expect(view.rowFeeds[attr("Dim Customer", "customer_key")]!.list).toBe("");
  });

  it("four-eyes: each mapping's last content editor reaches the page only while it is on (O9)", async () => {
    const [workspace, model] = await Promise.all([store.workspaces.get(WS), store.model.load(WS)]);
    const off = await moduleView(store, workspace!, model, ACTIONS, []);
    expect((off.data.infocube as { contentAuthors: object }).contentAuthors).toEqual({});
    const on = await moduleView(store, { ...workspace!, four_eyes: true }, model, ACTIONS, []);
    const authors = (on.data.infocube as { contentAuthors: Record<string, string> }).contentAuthors;
    // without events the creator is the last editor: the star's author
    expect(Object.keys(authors)).toHaveLength(20);
    expect(new Set(Object.values(authors)).size).toBe(1);
  });
});

describe("the homes' thumbnails (C12)", () => {
  it("draw a dimensional card filtered to Mapped or Not mapped at the canvas's height", async () => {
    const db = await readDb(file);
    const canvas = db.canvas.find((c) => c.workspace_id === WS && c.name === "Sales star")!;
    const dimensional = new Set(db.entity.filter((e) => e.model_level === "dimensional").map((e) => e.id));
    const cards = db.canvas_item.filter((i) => i.canvas_id === canvas.id && i.entity_id && dimensional.has(i.entity_id));
    cards.forEach((c, n) => (c.row_filter = n % 2 ? "unmapped" : "mapped"));
    await writeDb(file, db);
    store = createLocalDataStore(file, STORE_SCHEMA);

    const [model, items, frames, notes, labels, labelLinks, requirements] = await Promise.all([
      store.model.load(WS),
      store.canvasItems.listOfCanvas(WS, canvas.id),
      store.frames.listOfCanvas(WS, canvas.id),
      store.notes.listOfCanvas(WS, canvas.id),
      store.labels.list(WS),
      store.labels.listLinks(WS),
      store.requirements.list(WS),
    ]);
    const workspace = await store.workspaces.get(WS);
    const view = await moduleView(store, workspace!, model, ACTIONS);
    const rowFeeds = await moduleRowFeeds(WS, model, store);
    const built = buildCards(model, items, undefined, null, [], undefined, view.roles, view.rowMarks, view.rowFeeds);
    const thumb = canvasThumbnails([canvas], { items, frames, notes }, thumbnailIndex(model, { requirements, labels, labelLinks, rowFeeds })).get(canvas.id)!;
    const key = (r: { x: number; y: number; w: number; h: number }) => `${r.x},${r.y} ${r.w}×${r.h}`;
    const drawn = thumb.shapes.filter((s): s is ThumbnailRect => s.kind === "entity" || s.kind === "table").map((s) => key({ x: s.x, y: s.y, w: s.width, h: s.height }));
    expect(drawn.sort()).toEqual(built.map((k) => key({ x: k.x, y: k.y, w: cardWidth(k), h: cardHeight(k) })).sort());
    // without the feeds the filtered cards differ: the finding this fixes
    const plain = canvasThumbnails([canvas], { items, frames, notes }, thumbnailIndex(model, { requirements, labels, labelLinks })).get(canvas.id)!;
    expect(plain.shapes.filter((s): s is ThumbnailRect => s.kind === "entity").map((s) => key({ x: s.x, y: s.y, w: s.width, h: s.height })).sort()).not.toEqual(
      built.filter((k) => k.kind === "ent").map((k) => key({ x: k.x, y: k.y, w: cardWidth(k), h: cardHeight(k) })).sort(),
    );
  });
});
