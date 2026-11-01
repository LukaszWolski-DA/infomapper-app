// The thumbnail's cards and blocks against the canvas's own (slice 12b, PRD P6; step 1, answer 1): on every canvas of
// the seed and of "Performance test" (row filters, collapsed cards, PERF-2's live context cards, collapsed frames),
// each entity and table card the thumbnail draws has the rectangle the canvas gives it (`cardHeight(buildCards(…))`,
// built as the canvas page builds it), and each collapsed frame's block the canvas's `frameShape`. Here, outside the
// layers, because `domain` cannot import the canvas.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCards } from "@/canvas/card-data";
import { buildFrames, frameShape, memberCounts } from "@/canvas/frame-data";
import { cardHeight, cardWidth } from "@/canvas/geometry";
import { seedLargeData } from "@/data/local/dev-data";
import { readDb, writeDb } from "@/data/local/file";
import { LARGE_IDS } from "@/data/local/seed-large";
import { createLocalDataStore } from "@/data/local/store";
import type { DataStore } from "@/data/ports";
import { liveMembership } from "@/domain/model/live";
import { canvasThumbnails, thumbnailIndex, type ThumbnailRect } from "@/domain/model/thumbnail";

let dir: string;
let store: DataStore;
let workspaceIds: string[];

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "infomapper-thumbnails-"));
  const file = path.join(dir, "dev-db.json");
  await seedLargeData(file); // the seed, then "Performance test"
  // two of "100 cards"'s frames collapsed, so blocks and the cards they hide are compared too (the seed has no frames)
  const db = await readDb(file);
  for (const f of db.frame.filter((x) => x.canvas_id === LARGE_IDS.canvas).slice(0, 2)) f.collapsed = true;
  await writeDb(file, db);
  workspaceIds = db.workspace.map((w) => w.id);
  store = createLocalDataStore(file);
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const key = (r: { x: number; y: number; w: number; h: number }) => `${r.x},${r.y} ${r.w}×${r.h}`;
const sorted = (xs: string[]) => [...xs].sort();

describe("the thumbnail's heights are the canvas's (P6)", () => {
  it("on every canvas of the seed and of “Performance test”", async () => {
    let cardsCompared = 0, blocksCompared = 0, liveCompared = 0, filtered = 0;
    for (const ws of workspaceIds) {
      const [model, items, frames, notes, canvases, labels, labelLinks, requirements] = await Promise.all([
        store.model.load(ws),
        store.canvasItems.list(ws),
        store.frames.list(ws),
        store.notes.list(ws),
        store.canvases.list(ws),
        store.labels.list(ws),
        store.labels.listLinks(ws),
        store.requirements.list(ws),
      ]);
      const live = canvases.filter((c) => c.deleted_at === null);
      const thumbs = canvasThumbnails(live, { items, frames, notes }, thumbnailIndex(model, { requirements, labels, labelLinks }));
      for (const c of live) {
        const own = items.filter((i) => i.canvas_id === c.id);
        // as the canvas page: live only while its label exists
        const liveLabel = c.live_label_id ? labels.find((l) => l.id === c.live_label_id) : undefined;
        const membership = liveLabel ? liveMembership(liveLabel.id, { ...model, links: labelLinks }) : null;
        const cards = buildCards(model, own, undefined, liveLabel && membership ? { labelName: liveLabel.name, relevantRows: membership.relevantRows, removeOf: () => ({ direct: true, what: "", others: 0 }) } : null);
        const frameData = buildFrames(frames.filter((f) => f.canvas_id === c.id));
        const collapsed = new Set(frameData.filter((f) => f.collapsed).map((f) => f.id));
        const counts = memberCounts(cards);

        const t = thumbs.get(c.id)!;
        const drawn = (kind: ThumbnailRect["kind"]) => t.shapes.filter((s): s is ThumbnailRect => s.kind === kind).map((s) => key({ x: s.x, y: s.y, w: s.width, h: s.height }));
        const shown = cards.filter((k) => !(k.frameId && collapsed.has(k.frameId)));
        expect(sorted([...drawn("entity"), ...drawn("table")]), c.name).toEqual(sorted(shown.map((k) => key({ x: k.x, y: k.y, w: cardWidth(k), h: cardHeight(k) }))));
        expect(sorted(drawn("block")), c.name).toEqual(sorted(frameData.filter((f) => f.collapsed).map((f) => key(frameShape(f, counts)))));
        cardsCompared += shown.length;
        blocksCompared += collapsed.size;
        if (membership) liveCompared += shown.length;
        filtered += shown.filter((k) => k.rowFilter !== "all" || k.collapsed).length;
      }
    }
    // the comparison reached what it is for: "Performance test"'s cards, PERF-2's context cards and the row filters
    expect(cardsCompared).toBeGreaterThan(200);
    expect(liveCompared).toBeGreaterThan(0);
    expect(filtered).toBeGreaterThan(0);
    expect(blocksCompared).toBe(2);
  });
});
