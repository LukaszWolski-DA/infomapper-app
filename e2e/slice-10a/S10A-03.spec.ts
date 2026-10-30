import { expect, test, type Page } from "./fixtures";
import { canvasUrl, ids, loadModel, openCanvas, recordToasts, rowNamed, signInAs, STALE, toasts } from "./helpers";

// Moving an attribute (item 2): it renumbers the entity's other attributes, so it saves over all of them (`saveRows`).
// A sibling's save started while the move is on its way waits for it and sends the version the move returned.

/** Order Line's attributes by name, in their order, from the e2e data file. */
async function order(): Promise<string[]> {
  const line = (await ids()).entity("Order Line");
  const live = (await loadModel()).attributes.filter((a) => a.entity_id === line.id && a.deleted_at === null);
  return live.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)).map((a) => a.name);
}

async function open(page: Page) {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  // Order Line (840, 568) in view at 100 %
  await openCanvas(page, canvasUrl(), { x: -640, y: -480, zoom: 1 });
}

const name = (page: Page) => page.getByTestId("input-attribute-name");

test("S10A-03: Ctrl+↓ on a row, then at once a sibling's name in its panel: both stored, no toast, the new order kept", async ({ page }) => {
  const start = await order();
  const [first, second, third] = start as [string, string, string];
  await open(page);
  await rowNamed(page, "Order Line", first).click();
  await page.keyboard.press("Control+ArrowDown");
  await rowNamed(page, "Order Line", third).click();
  await name(page).fill(`${third}_x`);
  await name(page).press("Enter");
  await expect.poll(order).toEqual([second, first, `${third}_x`, ...start.slice(3)]);
  expect(await toasts(page)).not.toContain(STALE);
  expect(await toasts(page)).toEqual([]);
});

test("S10A-03: a sibling's name, Enter, then at once Ctrl+↑ on another row: both stored", async ({ page }) => {
  const start = await order();
  const [first, second, third] = start as [string, string, string];
  await open(page);
  await rowNamed(page, "Order Line", first).click();
  await name(page).fill(`${first}_x`);
  await name(page).press("Enter");
  await rowNamed(page, "Order Line", third).click();
  await page.keyboard.press("Control+ArrowUp");
  await expect.poll(order).toEqual([`${first}_x`, third, second, ...start.slice(3)]);
  expect(await toasts(page)).toEqual([]);
});

test("S10A-03: the moved attribute's own panel saved right after the move: stored", async ({ page }) => {
  const start = await order();
  const [first, second] = start as [string, string];
  await open(page);
  await rowNamed(page, "Order Line", first).click();
  await page.keyboard.press("Control+ArrowDown");
  await name(page).fill(`${first}_x`);
  await name(page).press("Enter");
  await expect.poll(order).toEqual([second, `${first}_x`, ...start.slice(2)]);
  expect(await toasts(page)).toEqual([]);
});
