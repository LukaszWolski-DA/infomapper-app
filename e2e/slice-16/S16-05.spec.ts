// S16-05 (slice 16, item 3, D-71): "Between entities" off hides the logical, dimensional and self relationships and
// the relationship bundles of a collapsed frame; source lines, mappings and trace lines stay. The chip "Entity
// relationships hidden" shows and its × brings them back. Not an undo step; kept after a reload; another canvas is
// unchanged.

import { test as starTest } from "../slice-15a/fixtures";
import { expect, test, type Page } from "./fixtures";
import { canvasUrl, chip, chipOff, collapse, lookOf, makeFrame, openCanvas, openCanvasMenu, SEED_IDS, selfRelationship, signInAs, STAR, STAR_VIEW, starUrl, undoButton, WHOLE_CO } from "./helpers";

const layer = (page: Page) => page.getByTestId("layer-lines");
const count = (page: Page, testId: string) => layer(page).getByTestId(testId).count();
const relBundles = (page: Page) => layer(page).locator('[data-testid="line-bundle"]:not([data-count])');
const mapBundles = (page: Page) => layer(page).locator('[data-testid="line-bundle"][data-count]');

async function switchKind(page: Page, tab: string, testId: "menu-item-lines-entities" | "menu-item-lines-sources") {
  const menu = await openCanvasMenu(page, tab);
  await menu.getByTestId(testId).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("menu-canvas")).toHaveCount(0); // closed before the next open
}

test("S16-05: “Between entities” off hides entity relationships with the self loop; the other lines stay; the chip's × brings them back", async ({ page }) => {
  await selfRelationship("Customer");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  const before = { rel: await count(page, "line-relationship"), src: await count(page, "line-source"), map: await count(page, "line-mapping"), trace: await count(page, "line-trace") };
  expect(before.rel, "relationships, the loop among them").toBeGreaterThan(1);
  expect(before.src, "source lines").toBeGreaterThan(0);
  expect(before.map, "mappings").toBeGreaterThan(0);
  expect(before.trace, "trace lines").toBeGreaterThan(0);
  await expect(undoButton(page)).toBeDisabled();

  await switchKind(page, "Customer & orders", "menu-item-lines-entities");
  await expect.poll(() => count(page, "line-relationship")).toBe(0);
  expect({ src: await count(page, "line-source"), map: await count(page, "line-mapping"), trace: await count(page, "line-trace") }).toEqual({ src: before.src, map: before.map, trace: before.trace });
  await expect(chip(page, "entity-relationships")).toContainText("Entity relationships hidden");
  await expect(chip(page, "entity-relationships")).toHaveAttribute("title", "Lines between entities are hidden on this canvas");
  // kept with the canvas, outside undo; another canvas unchanged
  await expect.poll(async () => (await lookOf(SEED_IDS.canvasCustomerOrders)).hideEntityRelationships).toBe(true);
  expect((await lookOf(SEED_IDS.canvasOrderLines)).hideEntityRelationships).toBeUndefined();
  await expect(undoButton(page)).toBeDisabled();
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  expect(await count(page, "line-relationship")).toBe(0);
  await expect(chip(page, "entity-relationships")).toBeVisible();
  // the menu's check item shows it off
  const menu = await openCanvasMenu(page, "Customer & orders");
  await expect(menu.getByTestId("menu-item-lines-entities")).toHaveAttribute("aria-checked", "false");
  await expect(menu.getByTestId("menu-item-lines-sources")).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("menu-canvas")).toHaveCount(0); // closed before the next open

  // the chip's × brings them back
  await chipOff(page, "entity-relationships").click();
  await expect.poll(() => count(page, "line-relationship")).toBe(before.rel);
  await expect(chip(page, "entity-relationships")).toHaveCount(0);
  await expect.poll(async () => (await lookOf(SEED_IDS.canvasCustomerOrders)).hideEntityRelationships).toBeUndefined();
});

test("S16-05: a collapsed frame's relationship bundle goes with them; the mapping lines stay", async ({ page }) => {
  // Customer and Sales Order in a frame, collapsed: Sales Order's relationship to Order Line leaves it as a bundle
  await collapse(await makeFrame({ x: 480, y: 0, width: 288, height: 840 }, { name: "Customer and orders" }));
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await expect.poll(() => relBundles(page).count()).toBeGreaterThan(0);
  const maps = async () => (await mapBundles(page).count()) + (await count(page, "line-mapping"));
  const before = await maps();
  expect(before).toBeGreaterThan(0);
  await switchKind(page, "Customer & orders", "menu-item-lines-entities");
  await expect.poll(() => relBundles(page).count()).toBe(0);
  expect(await maps()).toBe(before);
});

starTest("S16-05: dimensional relationships go too (the Sales star)", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, starUrl(), STAR_VIEW);
  await expect.poll(() => count(page, "line-relationship")).toBeGreaterThan(0);
  await switchKind(page, "Sales star", "menu-item-lines-entities");
  await expect.poll(() => count(page, "line-relationship")).toBe(0);
  await expect(chip(page, "entity-relationships")).toBeVisible();
  await expect.poll(async () => (await lookOf(STAR)).hideEntityRelationships).toBe(true);
});
