// “Performance test – requirements” (slice 4b-2, PRD item 26, answer E; acceptance doc Q8): a second canvas of the
// project “Performance” with the same layout, frames and notes as “100 cards”, plus 12 requirement cards with about 120
// trace lines, for S4B2-10 to S4B2-15. “100 cards” stays as it is in `slice-04b1`: no card there, and the new
// requirements link only elements whose cards already carry a requirement marker there (the entities of REQ-101 and
// REQ-102 and the tables of REQ-103), so its markers change their numbers, never their elements.
//
//   REQ-101, REQ-102 (existing)  by ent:19 and ent:4, in the 30 % view around ent:23
//   REQ-104 to REQ-109 (new)     6 to 8 links each to ent:4, ent:7 and ent:19 (REQ-109 also ent:3) and their
//                                attributes, by their first link (item 15's rule), in the same view
//   REQ-112 (new)                ent:3, its mapping from src:29 (m45), src:29 and three of its columns: lines from the
//                                30 % view into the dense one; placed at that view's top centre
// Item 15's rule keeps frames clear (Łukasz after step 7): ent:4, ent:7 and ent:19 lie in frame f4, so their cards
// stand below it, still in the 30 % view (ent:3's frame f5 reaches below that view, so no card is placed by ent:3).
//   REQ-103 (existing), REQ-110, REQ-111 (new)  the dense view's tables and columns. The cards stand in the free strip
//                                above that view's frames (“Place its card on this canvas”, item 13: the view's top
//                                centre): beside the dense tables there is no room (their frames abut)

import type { Uuid } from "@/domain/ids";
import { cardHeightFor } from "@/domain/model/card-size";
import { targetColumns, type LabelTarget } from "@/domain/model/labels";
import { notePlaces, notePosition } from "@/domain/model/notes";
import { requirementCardSpots, type Box } from "@/domain/model/requirement-placement";
import type { CanvasItem, Requirement, RequirementLink } from "@/domain/types";
import type { GenDataSet } from "./large-generator";
import type { DevDb } from "./schema";

/** A requirement card's height for placing it before it is drawn: two name lines (as the demo seed). */
const CARD_HEIGHT = 111;
export const LARGE_REQUIREMENTS_CANVAS_NAME = "Performance test – requirements";
export const LARGE_REQUIREMENT_KEY_AFTER_CARDS = 113;

interface NewRequirement {
  key: string;
  name: string;
  kind: Requirement["kind"];
  /** Generator ids: `ent:N` (the entity), `src:N` (the table), a row id (attribute or column), `m:<mapping id>`. */
  links: string[];
}

/**
 * Adds the canvas, its copy of “100 cards”' frames, cards and notes, REQ-104 to REQ-112 and the 12 requirement cards.
 * `canvasId`: the new canvas; `fromCanvasId`: “100 cards”.
 */
export function addLargeRequirementCards(o: { db: DevDb; data: GenDataSet; workspaceId: Uuid; projectId: Uuid; canvasId: Uuid; fromCanvasId: Uuid; by: Uuid; at: string; id: (key: string) => Uuid }): void {
  const { db, data, id } = o;
  const audit = { workspace_id: o.workspaceId, version: 1, created_at: o.at, created_by: o.by, updated_at: o.at, updated_by: o.by, deleted_at: null };
  const copyId = (old: Uuid) => id(`req-canvas:${old}`);
  const from = db.canvas.find((c) => c.id === o.fromCanvasId)!;
  db.canvas.push({ ...from, ...audit, id: o.canvasId, name: LARGE_REQUIREMENTS_CANVAS_NAME, look: { ...from.look } });
  const order = Math.max(...db.project_canvas.filter((l) => l.project_id === o.projectId).map((l) => l.sort_order)) + 1;
  db.project_canvas.push({ project_id: o.projectId, canvas_id: o.canvasId, workspace_id: o.workspaceId, sort_order: order, added_at: o.at, added_by: o.by });

  // the same layout: frames, cards and notes, with their references moved to the copies
  for (const f of db.frame.filter((x) => x.canvas_id === o.fromCanvasId && x.deleted_at === null)) db.frame.push({ ...f, id: copyId(f.id), canvas_id: o.canvasId });
  const items = db.canvas_item.filter((x) => x.canvas_id === o.fromCanvasId && x.deleted_at === null);
  for (const i of items) db.canvas_item.push({ ...i, id: copyId(i.id), canvas_id: o.canvasId, frame_id: i.frame_id ? copyId(i.frame_id) : null });
  for (const n of db.note.filter((x) => x.canvas_id === o.fromCanvasId && x.deleted_at === null)) {
    db.note.push({
      ...n,
      id: copyId(n.id),
      canvas_id: o.canvasId,
      frame_id: n.frame_id ? copyId(n.frame_id) : null,
      pin_canvas_item_id: n.pin_canvas_item_id ? copyId(n.pin_canvas_item_id) : null,
      pin_frame_id: n.pin_frame_id ? copyId(n.pin_frame_id) : null,
    });
  }

  // REQ-104 to REQ-112
  const card = (gen: string) => data.cards.find((c) => c.id === gen)!;
  const rows = (gen: string, from: number, to: number) => card(gen).rows.slice(from, to).map((r) => r.id);
  const m45 = data.mappings.find((m) => m.id === "m45")!;
  const added: NewRequirement[] = [
    { key: "REQ-104", name: "Party keys", kind: "data", links: rows("ent:7", 0, 8) },
    { key: "REQ-105", name: "Contract history", kind: "need", links: ["ent:4", ...rows("ent:4", 0, 6)] },
    { key: "REQ-106", name: "Account balances", kind: "business_rule", links: ["ent:19", ...rows("ent:19", 0, 6)] },
    { key: "REQ-107", name: "Balance history", kind: "need", links: ["ent:19", ...rows("ent:19", 6, 11)] },
    { key: "REQ-108", name: "Party attributes complete", kind: "dq_rule", links: rows("ent:7", 8, 16) },
    { key: "REQ-109", name: "Core entities traced", kind: "data", links: ["ent:4", "ent:7", "ent:19", "ent:3", ...rows("ent:7", 16, 20)] },
    { key: "REQ-110", name: "Ledger columns", kind: "data", links: rows("src:57", 0, 10) },
    { key: "REQ-111", name: "Source keys present", kind: "dq_rule", links: [...rows("src:1", 0, 6), ...rows("src:47", 0, 4)] },
    { key: "REQ-112", name: "Exposure source", kind: "data", links: ["ent:3", `m:${m45.id}`, "src:29", ...rows("src:29", 0, 3)] },
  ];
  const rowKind = new Map<string, "attribute" | "source_column">();
  for (const c of data.cards) for (const r of c.rows) rowKind.set(r.id, c.kind === "ent" ? "attribute" : "source_column");
  const cardKind = new Map(data.cards.map((c) => [c.id, c.kind]));
  const target = (gen: string): LabelTarget =>
    cardKind.get(gen) === "ent"
      ? { kind: "entity", id: id(`entity:${gen}`) }
      : cardKind.get(gen) === "src"
        ? { kind: "source_table", id: id(`table:${gen}`) }
        : gen.startsWith("m:")
          ? { kind: "mapping", id: id(`mapping:${gen.slice(2)}`) }
          : rowKind.get(gen) === "attribute"
            ? { kind: "attribute", id: id(`attribute:${gen}`) }
            : { kind: "source_column", id: id(`column:${gen}`) };
  for (const r of added) {
    const requirement: Requirement = {
      ...audit,
      id: id(`requirement:${r.key}`),
      key: r.key,
      kind: r.kind,
      name: r.name,
      description_html: null,
      description_text: null,
      expression: null,
      severity: null,
      status: "draft",
      priority: "should",
      owner_name: null,
      external_ref: null,
      parent_id: null,
    };
    db.requirement.push(requirement);
    for (const gen of r.links) {
      const t = target(gen);
      const link: RequirementLink = { ...audit, id: id(`requirement_link:${r.key}>${t.kind}:${t.id}`), requirement_id: requirement.id, ...targetColumns(t) };
      db.requirement_link.push(link);
    }
  }
  db.workspace.find((w) => w.id === o.workspaceId)!.requirement_key_next = LARGE_REQUIREMENT_KEY_AFTER_CARDS;

  // the cards: item 15's rule beside their first element (the card's box), keeping clear of cards, notes, frames (with
  // their name strip) and each other; the dense view's three at its top centre, one view-third apart
  const genOf = new Map(data.cards.map((c) => [c.id, c]));
  const box = (gen: string): Box => {
    const c = genOf.get(gen)!;
    return { x: c.x, y: c.y, w: c.w, h: cardHeightFor(c.rows.length) };
  };
  const copies = db.canvas_item.filter((i) => i.canvas_id === o.canvasId);
  const places = notePlaces(copies, db.frame.filter((f) => f.canvas_id === o.canvasId));
  const occupied: Box[] = [
    ...data.cards.map((c) => box(c.id)),
    ...db.note.filter((n) => n.canvas_id === o.canvasId).map((n) => ({ ...notePosition(n, places), w: n.width, h: 120 })),
  ];
  const frames: Box[] = data.frames.map((f) => ({ x: f.x, y: f.y - 30, w: f.w, h: f.h + 30 }));
  const src57 = genOf.get("src:57")!;
  const ent23 = genOf.get("ent:23")!;
  // the 30 % view around ent:23 (S4P-fading's), in canvas coordinates
  const overview = { x: ent23.x + ent23.w / 2 - 932 / 2 / 0.3, y: ent23.y + 200 - 740 / 2 / 0.3, w: 932 / 0.3, h: 740 / 0.3 };
  // S1A-14's dense view in canvas coordinates (the pane 932 × 740, `denseViewTables`)
  const dense = { x: src57.x - 768, y: src57.y - 300, w: 932, h: 740 };
  const place = (key: string, anchor: Box | null, view: Box = dense) => {
    const [spot] = requirementCardSpots(anchor, view, [CARD_HEIGHT], occupied, frames);
    occupied.push({ ...spot!, w: 230, h: CARD_HEIGHT });
    const item: CanvasItem = {
      ...audit,
      id: id(`canvas_item:${LARGE_REQUIREMENTS_CANVAS_NAME}:${key}`),
      canvas_id: o.canvasId,
      entity_id: null,
      source_table_id: null,
      requirement_id: id(`requirement:${key}`),
      x: spot!.x,
      y: spot!.y,
      width: null,
      collapsed: false,
      row_filter: "all",
      frame_id: null,
      live_level: null,
    };
    db.canvas_item.push(item);
  };
  place("REQ-101", box("ent:19"));
  place("REQ-102", box("ent:4"));
  for (const r of added.filter((x) => !["REQ-110", "REQ-111", "REQ-112"].includes(x.key))) {
    const first = r.links[0]!;
    // a card's own id, or the card holding the row
    place(r.key, box(genOf.has(first) ? first : data.cards.find((c) => c.rows.some((x) => x.id === first))!.id));
  }
  place("REQ-112", null, overview);
  ["REQ-103", "REQ-110", "REQ-111"].forEach((key, i) => place(key, null, { ...dense, x: dense.x + (i - 1) * 300 }));
}
