// Slice 16's measuring steps (S16-11): "Performance test" with 20 relationships between source tables (each of 20
// table cards in the 30 % view to the next, as S10B-10), written into the e2e data file only (never .data/dev-db.json,
// no seed option), its views (S6A-09's, as S11-13), and the switches: the two relationship kinds in the open canvas
// tab's menu, and the layer switch beside them.

import type { Page } from "@playwright/test";
import { buildWriteSet, type Write } from "../../src/domain/changes";
import { uuidv7 } from "../../src/domain/ids";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { loadModel, SEED_IDS, store } from "../slice-01a/helpers";
import { views as sliceElevenViews, type View } from "../slice-11/measure";

export const WS = LARGE_IDS.workspace;
export const views = sliceElevenViews;
export type { View };

/** 20 foreign keys in a ring between the 20 table cards nearest the 30 % view's centre, one change group. */
export async function twentySourceKeys(pane: { w: number; h: number }): Promise<number> {
  const view = views(pane)["30 % around ent:23"]!;
  const items = (await store().canvasItems.listOfCanvas(WS, LARGE_IDS.canvas)).filter((i) => i.deleted_at === null && i.source_table_id);
  const c = { x: (pane.w / 2 - view.x) / view.zoom, y: (pane.h / 2 - view.y) / view.zoom };
  const tables = items
    .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))
    .slice(0, 20)
    .map((i) => i.source_table_id!);
  const columns = (await loadModel(WS)).sourceColumns;
  const columnOf = (table: string, ordinal: number) => columns.find((x) => x.source_table_id === table && x.ordinal === ordinal)!.id;
  const ctx = { actorId: SEED_IDS.userLukasz, now: new Date().toISOString(), newId: () => uuidv7() };
  const std = () => ({ id: ctx.newId(), workspace_id: WS, version: 1, created_at: ctx.now, created_by: ctx.actorId, updated_at: ctx.now, updated_by: ctx.actorId, deleted_at: null });
  const writes: Write[] = [];
  tables.forEach((from, n) => {
    const to = tables[(n + 1) % tables.length]!;
    const rel = { ...std(), source_table_id: from, to_source_table_id: to, name: `FK_s16_${n}`, kind: "declared" as const, missing_since: null };
    writes.push({ kind: "insert", table: "source_relationship", row: rel });
    writes.push({ kind: "insert", table: "source_relationship_column", row: { ...std(), source_relationship_id: rel.id, from_column_id: columnOf(from, 2), to_column_id: columnOf(to, 1), sort_order: 0 } });
  });
  const applied = await store().apply(buildWriteSet(ctx, WS, writes));
  if (!applied.ok) throw new Error(applied.error.message);
  return tables.length;
}

export type Kind = "entities" | "sources" | "layer";

/** Each switch: what to click and the selector that matches once it is done (the kinds' menu stays open). */
export const SWITCHES: Record<Kind, Record<"on" | "off", { click: string; done: string }>> = {
  entities: {
    on: { click: '[data-testid="menu-item-lines-entities"]', done: '[data-testid="menu-item-lines-entities"][aria-checked="false"]' },
    off: { click: '[data-testid="menu-item-lines-entities"]', done: '[data-testid="menu-item-lines-entities"][aria-checked="true"]' },
  },
  sources: {
    on: { click: '[data-testid="menu-item-lines-sources"]', done: '[data-testid="menu-item-lines-sources"][aria-checked="false"]' },
    off: { click: '[data-testid="menu-item-lines-sources"]', done: '[data-testid="menu-item-lines-sources"][aria-checked="true"]' },
  },
  layer: {
    on: { click: '[data-testid="switch-layer"] [data-layer="mappings"]', done: '[data-testid="switch-layer"] [data-layer="mappings"][aria-pressed="true"]' },
    off: { click: '[data-testid="switch-layer"] [data-layer="all"]', done: '[data-testid="switch-layer"] [data-layer="all"][aria-pressed="true"]' },
  },
};

/** Opens the open canvas tab's menu, where the two kinds are; every run measures with it open, the layer's too. */
export async function openTabMenu(page: Page): Promise<void> {
  const tab = page.locator('[data-testid="tab-canvas"][aria-selected="true"]');
  await tab.hover();
  await tab.getByTestId("button-canvas-menu").click();
  await page.getByTestId("menu-canvas").waitFor();
}

/** What a view draws: relationship lines, source lines, and the viewport's elements. */
export const drawn = (page: Page) =>
  page.evaluate(() => ({
    relationshipLines: document.querySelectorAll('[data-testid="layer-lines"] [data-testid="line-relationship"]').length,
    sourceLines: document.querySelectorAll('[data-testid="layer-lines"] [data-testid="line-source"]').length,
    viewportElements: document.querySelectorAll(".react-flow__viewport *").length,
  }));
