// S16-06 (slice 16, item 3, D-71): "Between source tables" off hides D-62's lines and shows the chip "Source
// relationships hidden". With both kinds off, "Show all" brings both back. In Mappings both chips still show while
// switched off (P9). "Duplicate layout" copies the switches; "Use this look on all canvases" does not (P8).

import { expect, test, type Page } from "./fixtures";
import { canvasUrl, chip, lookOf, openCanvas, openCanvasMenu, RETAIL, SEED_IDS, signInAs, store, WHOLE_CO } from "./helpers";

const count = (page: Page, testId: string) => page.getByTestId("layer-lines").getByTestId(testId).count();

async function switchKind(page: Page, testId: "menu-item-lines-entities" | "menu-item-lines-sources") {
  const menu = await openCanvasMenu(page, "Customer & orders");
  await menu.getByTestId(testId).click();
  await expect(menu.getByTestId(testId)).toHaveAttribute("aria-checked", "false"); // the menu stays open
  await page.keyboard.press("Escape");
}

test("S16-06: “Between source tables” off hides the source lines; with both kinds off “Show all” brings both back", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  const rel = await count(page, "line-relationship"), src = await count(page, "line-source");
  expect(src).toBeGreaterThan(0);

  await switchKind(page, "menu-item-lines-sources");
  await expect.poll(() => count(page, "line-source")).toBe(0);
  expect(await count(page, "line-relationship")).toBe(rel);
  await expect(chip(page, "source-relationships")).toContainText("Source relationships hidden");
  await expect(chip(page, "source-relationships")).toHaveAttribute("title", "Lines between source tables are hidden on this canvas");

  await switchKind(page, "menu-item-lines-entities");
  await expect.poll(() => count(page, "line-relationship")).toBe(0);
  await page.getByTestId("button-view-show-all").click();
  await expect.poll(() => count(page, "line-source")).toBe(src);
  await expect.poll(() => count(page, "line-relationship")).toBe(rel);
  await expect(chip(page, "entity-relationships")).toHaveCount(0);
  await expect(chip(page, "source-relationships")).toHaveCount(0);
  await expect.poll(async () => lookOf(SEED_IDS.canvasCustomerOrders)).toEqual({ background: "grey", grid: "dots", layer: "all" });
});

test("S16-06: in Mappings both chips still show while switched off", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 }); // room for the three chips without “+{n}”
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await page.locator('[data-testid="switch-layer"] [data-layer="mappings"]').click();
  await expect.poll(() => count(page, "line-relationship")).toBe(0);
  await switchKind(page, "menu-item-lines-entities");
  await switchKind(page, "menu-item-lines-sources");
  await expect(chip(page, "layer")).toBeVisible();
  await expect(chip(page, "entity-relationships")).toBeVisible();
  await expect(chip(page, "source-relationships")).toBeVisible();
});

test("S16-06: “Duplicate layout” copies the switches; “Use this look on all canvases” does not", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await switchKind(page, "menu-item-lines-entities");
  await switchKind(page, "menu-item-lines-sources");
  await expect.poll(async () => lookOf(SEED_IDS.canvasCustomerOrders)).toMatchObject({ hideEntityRelationships: true, hideSourceRelationships: true });

  // "Use this look on all canvases": the other canvas gets the background and grid only
  const menu = await openCanvasMenu(page, "Customer & orders");
  await menu.locator('[data-background="blue"]').click();
  await menu.getByTestId("menu-item-look-all").click();
  await expect.poll(async () => (await lookOf(SEED_IDS.canvasOrderLines)).background).toBe("blue");
  expect(await lookOf(SEED_IDS.canvasOrderLines)).toEqual({ background: "blue", grid: "dots", layer: "all" });

  // "Duplicate layout": the copy has both switches
  const again = await openCanvasMenu(page, "Customer & orders");
  await again.getByTestId("menu-item-duplicate").click();
  await expect.poll(async () => (await store().canvases.list(RETAIL)).some((c) => c.name === "Customer & orders (copy)" && c.deleted_at === null)).toBe(true);
  const copy = (await store().canvases.list(RETAIL)).find((c) => c.name === "Customer & orders (copy)")!;
  expect(copy.look).toMatchObject({ background: "blue", hideEntityRelationships: true, hideSourceRelationships: true });
});
