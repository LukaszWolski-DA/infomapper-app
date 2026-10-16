// Three requirements in “Performance test” for the fading scenarios of slice 4p (PRD item 2): a small lens and a large
// one around the entity with the most relationships (ent:23, the Focus scenario), and one in S1A-14's dense area, so that
// what they light is in the measured views. None has a card, so the canvas draws the same elements as before (S4A-14,
// S4P-12).
//
//   REQ-101 “Lens, small”: five mapped attributes of ent:19 and one without a mapping (its rows coloured covered or gap)
//   REQ-102 “Lens, large”: every attribute of the entities ent:3, ent:4, ent:7 and ent:19 (46 attribute links since slice
//           4b-1: an entity link no longer brings its attributes, D-31, so the large set stays what slice 4p and 4b-1's
//           step 0 measured: 29 cards, 29 lines, 46 rows), about half of the cards in the 30 % view
//   REQ-103 “Lens, dense area”: the source tables in S1A-14's 100 % view around src:57, the heaviest view (Łukasz after
//           step 0)

import type { Uuid } from "@/domain/ids";
import { targetColumns, type LabelTarget } from "@/domain/model/labels";
import type { Requirement, RequirementLink } from "@/domain/types";
import { cardHeight, type GenDataSet } from "./large-generator";
import type { DevDb } from "./schema";

/** The entity the Focus scenario lights (the most relationships) and the views are centred on. */
export const LARGE_FOCUS_CARD = "ent:23";
/** The small lens's entity. */
const SMALL_ENTITY = "ent:19";
/** The large lens's entities: REQ-102 links all their attributes. */
const LARGE_ENTITIES = ["ent:3", "ent:4", "ent:7", "ent:19"] as const;
export const LARGE_LENS_KEYS = { small: "REQ-101", large: "REQ-102", dense: "REQ-103" } as const;
export const LARGE_REQUIREMENT_KEY_NEXT = 104;

/**
 * The tables in S1A-14's 100 % view (`{ x: 768 − src57.x, y: 300 − src57.y }` in the pane): the pane of the measuring
 * window (1536 × 864, both panels open) is 932 px wide and about 740 px high.
 */
export function denseViewTables(data: GenDataSet, pane = { w: 932, h: 740 }): string[] {
  const src57 = data.cards.find((c) => c.id === "src:57")!;
  const ox = 768 - src57.x, oy = 300 - src57.y;
  return data.cards
    .filter((c) => c.kind === "src" && c.x + ox + c.w > 0 && c.x + ox < pane.w && c.y + oy + cardHeight(c.rows.length) > 0 && c.y + oy < pane.h)
    .map((c) => c.id);
}

/** The generator's row ids of the small lens: its entity's mapped attributes, then the first one without a mapping. */
export function smallLensRows(data: GenDataSet): string[] {
  const entity = data.cards.find((c) => c.id === SMALL_ENTITY)!;
  const mapped = new Set(data.mappings.filter((m) => m.entCard === SMALL_ENTITY).map((m) => m.attribute));
  const unmapped = entity.rows.find((r) => !mapped.has(r.id))!;
  return [...entity.rows.filter((r) => mapped.has(r.id)).map((r) => r.id), unmapped.id];
}

export function addLargeRequirements(o: { db: DevDb; data: GenDataSet; workspaceId: Uuid; by: Uuid; at: string; id: (key: string) => Uuid }): void {
  const { db, id } = o;
  const std = (key: string) => ({ id: id(key), workspace_id: o.workspaceId, version: 1, created_at: o.at, created_by: o.by, updated_at: o.at, updated_by: o.by, deleted_at: null });
  const add = (key: string, name: string, kind: Requirement["kind"], targets: LabelTarget[]) => {
    const requirement: Requirement = {
      ...std(`requirement:${key}`),
      key,
      kind,
      name,
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
    for (const t of targets) {
      const link: RequirementLink = { ...std(`requirement_link:${key}>${t.kind}:${t.id}`), requirement_id: requirement.id, ...targetColumns(t) };
      db.requirement_link.push(link);
    }
  };
  add(LARGE_LENS_KEYS.small, "Lens, small", "data", smallLensRows(o.data).map((row) => ({ kind: "attribute", id: id(`attribute:${row}`) })));
  add(
    LARGE_LENS_KEYS.large,
    "Lens, large",
    "need",
    LARGE_ENTITIES.flatMap((card) => o.data.cards.find((c) => c.id === card)!.rows.map((row) => ({ kind: "attribute" as const, id: id(`attribute:${row.id}`) }))),
  );
  add(LARGE_LENS_KEYS.dense, "Lens, dense area", "data", denseViewTables(o.data).map((card) => ({ kind: "source_table", id: id(`table:${card}`) })));
  db.workspace.find((w) => w.id === o.workspaceId)!.requirement_key_next = LARGE_REQUIREMENT_KEY_NEXT;
}
