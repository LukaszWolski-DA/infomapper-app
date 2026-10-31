// Slice 11's measuring steps (S11-13): "Performance test" with an alias on every entity and attribute, written into the
// e2e data file only (A4; never .data/dev-db.json, no seed option), and its views.

import { buildWriteSet, nextVersion, type Write } from "../../src/domain/changes";
import { uuidv7 } from "../../src/domain/ids";
import { generate } from "../../src/data/local/large-generator";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { loadModel, SEED_IDS, store } from "../slice-01a/helpers";

export const WS = LARGE_IDS.workspace;
/** An alias's prefix: an alias as long as its name plus three characters, and a selector for rows that show one. */
export const ALIAS_PREFIX = "PL ";

/** Every entity and attribute of "Performance test" gets the alias "PL {name}", in one change group. */
export async function aliasEverything(): Promise<{ entities: number; attributes: number }> {
  const model = await loadModel(WS);
  const ctx = { actorId: SEED_IDS.userLukasz, now: new Date().toISOString(), newId: () => uuidv7() };
  const writes: Write[] = [
    ...model.entities.map((e): Write => ({ kind: "update", table: "entity", before: e, row: nextVersion(ctx, e, { alias: `${ALIAS_PREFIX}${e.name}` }) })),
    ...model.attributes.map((a): Write => ({ kind: "update", table: "attribute", before: a, row: nextVersion(ctx, a, { alias: `${ALIAS_PREFIX}${a.name}` }) })),
  ];
  const applied = await store().apply(buildWriteSet(ctx, WS, writes));
  if (!applied.ok) throw new Error(applied.error.message);
  return { entities: model.entities.length, attributes: model.attributes.length };
}

export type View = { x: number; y: number; zoom: number };

/** S6A-09's two views on "Performance test": 30 % around ent:23 and S1A-14's 100 % dense view. */
export function views(pane: { w: number; h: number }): Record<string, View> {
  const data = generate();
  const ent23 = data.cards.find((c) => c.id === "ent:23")!, src57 = data.cards.find((c) => c.id === "src:57")!;
  return {
    "30 % around ent:23": { x: pane.w / 2 - (ent23.x + ent23.w / 2) * 0.3, y: pane.h / 2 - (ent23.y + 200) * 0.3, zoom: 0.3 },
    "100 % dense": { x: 768 - src57.x, y: 300 - src57.y, zoom: 1 },
  };
}
