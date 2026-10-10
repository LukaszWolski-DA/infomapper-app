// Slice 2c's steps build on slice 2b's (frames as test data, frames on the page, points on a frame's name).
// Added here: collapsing a frame as test data, blocks and bundles on the page, a mapping by its column and attribute,
// and the frames most tests use on Customer & orders. The seed's cards (x, y, height; all 256 wide): customers 40, 40,
// 300; web_users 40, 376, 170; order_header 40, 584, 248; order_line 1176, 600, 222; Customer 496, 40, 274;
// Sales Order 496, 568, 248; Order Line 840, 568, 222.

import { expect, type Page } from "@playwright/test";
import { removeFromCanvas } from "../../src/domain/commands/canvas-item";
import { setFrameCollapsed } from "../../src/domain/commands/frame";
import { asLukasz, box, frameNamed, item, loadModel, makeFrame, RETAIL, store, type Pt } from "../slice-02b/helpers";

export * from "../slice-02b/helpers";

/** Rectangles that take the named cards of Customer & orders when drawn (a frame takes the free cards fully inside). */
export const AROUND = {
  /** customers only. */
  customers: { x: 0, y: 0, width: 320, height: 360 },
  /** The three tables on the left: customers, web_users, order_header (not order_line). */
  tables: { x: 0, y: 0, width: 320, height: 880 },
  /** Customer only. */
  customer: { x: 480, y: 0, width: 320, height: 360 },
  /** Customer and Sales Order. */
  customerAndSales: { x: 480, y: 0, width: 288, height: 840 },
  /** Customer and Order Line, not Sales Order (its bottom is at 816). */
  customerAndLine: { x: 480, y: 0, width: 640, height: 800 },
  /** Sales Order and Order Line. */
  sales: { x: 480, y: 540, width: 640, height: 300 },
  /** customers and Customer. */
  customersAndCustomer: { x: 0, y: 0, width: 800, height: 360 },
  /** Every card of the canvas (7). */
  all: { x: 0, y: 0, width: 1460, height: 880 },
} as const;

/** Test data: a frame collapsed (or expanded) through the domain, as Łukasz. */
export async function collapse(frameId: string, collapsed = true): Promise<void> {
  const frame = (await store().frames.list(RETAIL)).find((f) => f.id === frameId)!;
  await asLukasz((ctx, access) => setFrameCollapsed(ctx, access, { frame }, { frameId, expectedVersion: frame.version, collapsed }));
}

/** Test data: a frame drawn around cards and collapsed. Returns its id. */
export async function collapsedFrame(rect: { x: number; y: number; width: number; height: number }, options: Parameters<typeof makeFrame>[1] = {}): Promise<string> {
  const id = await makeFrame(rect, options);
  await collapse(id);
  return id;
}

/** Test data: a card taken off Customer & orders. */
export async function removeCard(name: string): Promise<void> {
  const i = await item(name);
  await asLukasz((ctx, access) => removeFromCanvas(ctx, access, { item: i }, { canvasItemId: i.id, expectedVersion: i.version }));
}

/** A frame's collapsed state in the data. */
export const isCollapsed = async (name: string) => (await frameNamed(name))!.collapsed;

/** A collapsed frame's block on the page, by the frame's name. */
export const blockEl = (page: Page, name: string) => page.getByTestId("block").filter({ has: page.getByTestId("block-name").getByText(name, { exact: true }) });

/** The middle of the left part of a block's header (its name line), clear of the Expand button. */
export async function blockHeadPoint(page: Page, name: string): Promise<Pt> {
  const b = await box(blockEl(page, name).getByTestId("block-name"));
  return { x: b.x + Math.min(30, b.width / 3), y: b.y + b.height / 2 };
}

/** The lines of the line layer (not the hover layer): bundles, and the mapping lines by their mapping id. */
export const lineLayer = (page: Page) => page.getByTestId("layer-lines");
export const bundles = (page: Page) => lineLayer(page).getByTestId("line-bundle");
export const bundleWithCount = (page: Page, n: number) => lineLayer(page).locator(`[data-testid="line-bundle"][data-count="${n}"]`);
export const relBundle = (page: Page, label: string) => bundles(page).filter({ hasText: label });
export const mappingLines = (page: Page, mappingId: string) => lineLayer(page).locator(`[data-testid="line-mapping"][data-mapping="${mappingId}"]`);

/** A mapping's id by its input (`table.column`) and attribute (`Entity.attribute`). */
export async function mappingId(input: string, attribute: string): Promise<string> {
  const m = await loadModel();
  const [table, column] = input.split(".");
  const [entity, attr] = attribute.split(".");
  const t = m.sourceTables.find((x) => x.name === table)!;
  const c = m.sourceColumns.find((x) => x.source_table_id === t.id && x.name === column)!;
  const e = m.entities.find((x) => x.name === entity)!;
  const a = m.attributes.find((x) => x.entity_id === e.id && x.name === attr)!;
  const found = m.mappings.find((x) => x.attribute_id === a.id && m.mappingInputs.some((i) => i.mapping_id === x.id && i.source_column_id === c.id));
  expect(found, `mapping ${input} → ${attribute}`).toBeDefined();
  return found!.id;
}

/** The screen box of the canvas pane, and its middle. */
export async function paneMiddle(page: Page): Promise<Pt> {
  const p = await box(page.locator(".react-flow__pane"));
  return { x: p.x + p.width / 2, y: p.y + p.height / 2 };
}

/** Whether two canvas rectangles overlap. */
export const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
