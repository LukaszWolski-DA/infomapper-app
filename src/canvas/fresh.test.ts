// A fresh page that is older than the canvas (slice 3a step 5 for notes, slice 3b step 1 for frames and cards).

import { describe, expect, it } from "vitest";
import { frame, ids } from "@/domain/__fixtures__/domain";
import { buildFrames } from "./frame-data";
import { grownVersions, mergeFresh, type FreshRow } from "./fresh";

type Row = FreshRow & { x: number; text: string };
const row = (id: string, version: number, over: Partial<Row> = {}): Row => ({ id, version, createdAt: "2026-10-11T10:00:00.000Z", x: 0, text: `v${version}`, ...over });
const none = () => 0;
const READ = "2026-10-11T12:00:00.000Z";

describe("mergeFresh", () => {
  it("takes the page's rows when they are as new or newer", () => {
    expect(mergeFresh([row("a", 1)], [row("a", 2)], { readAt: READ, pendingOf: none }).map((r) => r.text)).toEqual(["v2"]);
    expect(mergeFresh([row("a", 2, { text: "mine" })], [row("a", 2)], { readAt: READ, pendingOf: none }).map((r) => r.text)).toEqual(["v2"]);
  });

  it("keeps what the canvas shows when the page has an older version, or writes are on their way", () => {
    expect(mergeFresh([row("a", 3)], [row("a", 2)], { readAt: READ, pendingOf: none }).map((r) => r.text)).toEqual(["v3"]);
    const mine = row("a", 1, { text: "being saved" });
    expect(mergeFresh([mine], [row("a", 1)], { readAt: READ, pendingOf: () => 1 })[0]).toBe(mine);
  });

  it("compares the version the canvas knows (its last write's) when given", () => {
    const known = new Map([["a", 3]]);
    const merged = mergeFresh([row("a", 1, { x: 500 })], [row("a", 2, { x: 100 })], { readAt: READ, pendingOf: none, versionOf: (r) => known.get(r.id) ?? r.version });
    expect(merged.map((r) => r.x)).toEqual([500]);
  });

  it("combines the canvas's row with the page's when told how (a card: the model's content from the page, the layout from the canvas)", () => {
    const merged = mergeFresh([row("a", 3, { x: 500, text: "old" })], [row("a", 2, { x: 100, text: "renamed" })], {
      readAt: READ,
      pendingOf: none,
      keep: (here, page) => ({ ...page, x: here.x }),
    });
    expect(merged).toEqual([row("a", 2, { x: 500, text: "renamed" })]);
  });

  it("keeps a row created after the page read the data, drops one created before (deleted meanwhile)", () => {
    const late = row("b", 1, { createdAt: "2026-10-11T12:00:01.000Z" }), early = row("c", 1, { createdAt: "2026-10-11T11:59:59.000Z" });
    expect(mergeFresh([row("a", 1), late, early], [row("a", 1)], { readAt: READ, pendingOf: none }).map((r) => r.id)).toEqual(["a", "b"]);
    expect(mergeFresh([late], [], { readAt: null, pendingOf: none })).toEqual([]);
  });

  it("keeps a row deleted here out while the page has it at that version; an undo brings it back at a higher one", () => {
    const deletedHere = new Map([["a", 2]]);
    expect(mergeFresh([], [row("a", 2)], { readAt: READ, pendingOf: none, deletedHere })).toEqual([]);
    expect(mergeFresh([], [row("a", 3)], { readAt: READ, pendingOf: none, deletedHere }).map((r) => r.version)).toEqual([3]);
  });
});

describe("grownVersions", () => {
  it("never lowers a version the canvas knows, and leaves rows with writes on their way alone", () => {
    const versions = new Map([["a", 3], ["b", 1], ["c", 1]]);
    expect(grownVersions([row("a", 2), row("b", 4), row("c", 5), row("d", 1)], (id) => versions.get(id), (id) => (id === "c" ? 1 : 0))).toEqual([
      ["b", 4],
      ["d", 1],
    ]);
  });
});

describe("the late refresh race (slice 3b, step 0): a label's page arriving after a move", () => {
  // 1. a label write starts a page refresh, which reads the frame at version 1, at x 40;
  // 2. the person drags the frame to x 400: saved at version 2, nothing on its way (a move does not refresh the page);
  // 3. the label's page arrives with the frame at version 1.
  const page = buildFrames([frame(ids.frameA, { x: 40, version: 1 })]);
  const moved = { ...page[0]!, x: 400 };

  it("keeps the frame where it was moved, instead of putting it back", () => {
    const versions = new Map<string, number>([[ids.frameA, 2]]);
    const merged = mergeFresh([moved], page, { readAt: READ, pendingOf: none, versionOf: (f) => Math.max(f.version, versions.get(f.id) ?? 0) });
    expect(merged.map((f) => f.x)).toEqual([400]);
  });

  it("keeps the version the move returned, so the next move is not refused as stale", () => {
    const versions = new Map<string, number>([[ids.frameA, 2]]);
    expect(grownVersions(page, (id) => versions.get(id), none)).toEqual([]);
  });
});
