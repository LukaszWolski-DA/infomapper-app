// Live label canvases through the local adapter (slice 3b, step 1): the domain's writes, completed by the live step
// (`completeLiveWrites`, as the server's write pipeline does), pass the adapter's rules (versions, keys, the one live
// canvas per label, live levels only on live canvases), and undo brings everything back.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CommandContext, CommandResult, WriteSet } from "@/domain/changes";
import { placeOnCanvas } from "@/domain/commands/canvas-item";
import { addLabel, deleteLabel } from "@/domain/commands/label";
import { completeLiveWrites, openLiveCanvas, removeFromLiveCanvas, type LiveWriteState } from "@/domain/commands/live";
import { revertChangeGroup } from "@/domain/commands/undo";
import { uuidv7 } from "@/domain/ids";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { DataStore } from "../ports";
import { seedDevData } from "./dev-data";
import { SEED_IDS } from "./seed";
import { seedId } from "./seed-model";
import { createLocalDataStore } from "./store";

let dir: string;
let store: DataStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-live-"));
  const file = path.join(dir, "dev-db.json");
  await seedDevData(file);
  store = createLocalDataStore(file);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const RETAIL = SEED_IDS.wsRetailDwh;
const PROJECT = SEED_IDS.projCustomer360;
const lukasz = SEED_IDS.userLukasz;
const id = (key: string) => seedId(RETAIL, key);
const ctx = (): CommandContext => ({ actorId: lukasz, now: new Date().toISOString(), newId: () => uuidv7() });

async function access(): Promise<WorkspaceAccess> {
  return { workspace: (await store.workspaces.get(RETAIL))!, member: await store.workspaces.getMember(RETAIL, lukasz) };
}

async function live(): Promise<LiveWriteState> {
  const [model, labels, labelLinks, canvases, canvasItems, frames, notes] = await Promise.all([
    store.model.load(RETAIL),
    store.labels.list(RETAIL),
    store.labels.listLinks(RETAIL),
    store.canvases.list(RETAIL),
    store.canvasItems.list(RETAIL),
    store.frames.list(RETAIL),
    store.notes.list(RETAIL),
  ]);
  return { ...model, labels, labelLinks, canvases, canvasItems, frames, notes };
}

/** A command's write set completed by the live step and applied, as `runCommand` does. */
async function write<T>(result: CommandResult<T>): Promise<{ value: T; writeSet: WriteSet }> {
  if (!result.ok) throw new Error(result.error.message);
  const completed = completeLiveWrites(ctx(), await access(), await live(), result.writeSet);
  if (!completed.ok) throw new Error(completed.error.message);
  expect(await store.apply(completed.writeSet)).toEqual({ ok: true });
  return { value: result.value, writeSet: completed.writeSet };
}

async function undo(writeSet: WriteSet) {
  const reverted = revertChangeGroup(ctx(), await access(), { events: writeSet.events, rows: await store.model.loadForUndo(RETAIL) }, "undo");
  await write(reverted);
}

const cr23 = async () => (await store.labels.list(RETAIL)).find((l) => l.name === "CR-23")!;
const cardsOf = async (canvasId: string) =>
  (await store.canvasItems.listOfCanvas(RETAIL, canvasId)).map((i) => [i.entity_id ?? i.source_table_id, i.live_level, i.row_filter]);

describe("a live canvas for CR-23 on the demo data", () => {
  it("opens with Customer full and the tables of its labeled mapping as context, arranged into frames; opening again changes nothing", async () => {
    const label = await cr23();
    const opened = await write(openLiveCanvas(ctx(), await access(), { ...(await live()), project: await store.projects.get(RETAIL, PROJECT), projectLinks: await store.canvases.listLinksOfProject(RETAIL, PROJECT) }, { labelId: label.id, projectId: PROJECT }));
    const canvasId = opened.value.canvasId;
    expect(await cardsOf(canvasId)).toEqual(
      expect.arrayContaining([
        [id("entity:customer"), "full", "all"],
        [id("table:webusers"), "context", "labeled"],
      ]),
    );
    expect((await store.frames.listOfCanvas(RETAIL, canvasId)).length).toBeGreaterThan(0);
    const again = openLiveCanvas(ctx(), await access(), { ...(await live()), project: await store.projects.get(RETAIL, PROJECT), projectLinks: await store.canvases.listLinksOfProject(RETAIL, PROJECT) }, { labelId: label.id, projectId: PROJECT });
    expect(again).toMatchObject({ ok: true, value: { canvasId, created: false }, writeSet: { writes: [] } });
  });

  it("follows labeling elsewhere, a card placed on it, removing a card (unlabel) and undo; deleting the label makes it normal", async () => {
    const label = await cr23();
    const { value } = await write(openLiveCanvas(ctx(), await access(), { ...(await live()), project: await store.projects.get(RETAIL, PROJECT), projectLinks: await store.canvases.listLinksOfProject(RETAIL, PROJECT) }, { labelId: label.id, projectId: PROJECT }));
    const canvasId = value.canvasId;
    const before = await cardsOf(canvasId);

    // labeling an attribute of Sales Order (on another canvas or in a panel) brings Sales Order as context
    const model = await store.model.load(RETAIL);
    const labeled = await write(addLabel(ctx(), await access(), { ...model, labels: await store.labels.list(RETAIL), links: await store.labels.listLinks(RETAIL) }, { target: { kind: "attribute", id: id("attribute:order.order_date") }, labelId: label.id }));
    expect(await cardsOf(canvasId)).toContainEqual([id("entity:order"), "context", "labeled"]);

    // one undo takes label and card away
    await undo(labeled.writeSet);
    expect(await cardsOf(canvasId)).toEqual(before);

    // a card placed on the live canvas labels its element (full) in the same change group
    const placed = await write(
      placeOnCanvas(ctx(), await access(), { canvas: await store.canvases.get(RETAIL, canvasId), entity: model.entities.find((e) => e.id === id("entity:line"))!, sourceTable: null, items: await store.canvasItems.listOfCanvas(RETAIL, canvasId) }, { canvasId, entityId: id("entity:line"), x: 2000, y: 0 }),
    );
    expect(await cardsOf(canvasId)).toContainEqual([id("entity:line"), "full", "all"]);
    expect(placed.writeSet.writes.filter((w) => w.table === "label_link")).toHaveLength(1);

    // removing it from the live canvas takes the label off, and the card goes
    const card = (await store.canvasItems.listOfCanvas(RETAIL, canvasId)).find((i) => i.entity_id === id("entity:line"))!;
    const removed = await write(removeFromLiveCanvas(ctx(), await access(), await live(), { canvasItemId: card.id, expectedVersion: card.version }));
    expect(removed.value).toMatchObject({ name: "Order Line", mode: "direct", keptAsContext: false });
    expect((await cardsOf(canvasId)).some(([e]) => e === id("entity:line"))).toBe(false);

    // deleting CR-23 makes the canvas normal; undo brings the label, its links and the live canvas back
    const s = await live();
    const deleted = await write(deleteLabel(ctx(), await access(), { label: await cr23(), links: s.labelLinks, pins: [], canvases: s.canvases, canvasItems: s.canvasItems }, { labelId: label.id, expectedVersion: (await cr23()).version }));
    expect((await store.canvases.get(RETAIL, canvasId))!.live_label_id).toBeNull();
    expect((await cardsOf(canvasId)).every(([, level, filter]) => level === null && filter !== "labeled")).toBe(true);
    await undo(deleted.writeSet);
    expect((await store.canvases.get(RETAIL, canvasId))!.live_label_id).toBe(label.id);
    expect(await cardsOf(canvasId)).toEqual(before);
  });
});
