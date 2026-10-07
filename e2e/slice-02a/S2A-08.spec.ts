import { setCanvasLook } from "../../src/domain/commands/canvas";
import { updateCanvasItem } from "../../src/domain/commands/canvas-item";
import { expect, test } from "./fixtures";
import { asLukasz, canvasTab, canvasUrl, card, expectToast, ids, key, loadItems, loadModel, openCanvas, openCanvasMenu, SEED_IDS, store, tabNames, WHOLE, signInAs } from "./helpers";

const layoutOf = (items: { entity_id: string | null; source_table_id: string | null; x: number; y: number; width: number | null; collapsed: boolean; row_filter: string }[]) =>
  items
    .map((i) => ({ target: i.entity_id ?? i.source_table_id, x: i.x, y: i.y, width: i.width, collapsed: i.collapsed, row_filter: i.row_filter }))
    .sort((a, b) => a.target!.localeCompare(b.target!));

test("S2A-08: “Duplicate layout” creates “Customer & orders (copy)” in this project with the same cards, positions, widths, collapsed states, row filters, look and layer; renaming an entity shows on both; Ctrl+Z removes the copy", async ({ page }) => {
  const { entity, table } = await ids();
  const ws = SEED_IDS.wsRetailDwh, original = SEED_IDS.canvasCustomerOrders;
  // the original gets a width, a collapsed card, a row filter, a look and a layer mode first
  const items = await loadItems();
  const customer = items.find((i) => i.entity_id === entity("Customer").id)!;
  const web = items.find((i) => i.source_table_id === table("web_users").id)!;
  const header = items.find((i) => i.source_table_id === table("order_header").id)!;
  await asLukasz((ctx, access) => updateCanvasItem(ctx, access, { item: customer }, { canvasItemId: customer.id, expectedVersion: customer.version, width: 320 }));
  await asLukasz((ctx, access) => updateCanvasItem(ctx, access, { item: web }, { canvasItemId: web.id, expectedVersion: web.version, collapsed: true }));
  await asLukasz((ctx, access) => updateCanvasItem(ctx, access, { item: header }, { canvasItemId: header.id, expectedVersion: header.version, rowFilter: "keys" }));
  const canvas = (await store().canvases.get(ws, original))!;
  await asLukasz((ctx, access) => setCanvasLook(ctx, access, { canvas }, { canvasId: original, expectedVersion: canvas.version, background: "blue", grid: "lines", layer: "mappings" }));

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  const menu = await openCanvasMenu(page, "Customer & orders");
  await menu.getByTestId("menu-item-duplicate").click();
  await expectToast(page, "Duplicated Customer & orders. Only the layout is copied; the model is shared.");
  await expect(page).toHaveURL(/\/c\/(?!01a0f9e9-200e)[0-9a-f-]+$/);
  const copyId = page.url().split("/c/")[1]!;
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");

  // right after the original in this project, with the same layout, look and layer
  expect(await tabNames(page)).toEqual(["Customer & orders", "Customer & orders (copy)"]);
  await expect(canvasTab(page, "Customer & orders (copy)")).toHaveAttribute("aria-selected", "true");
  const copy = (await store().canvases.get(ws, copyId))!;
  expect(copy.name).toBe("Customer & orders (copy)");
  expect(copy.look).toEqual({ background: "blue", grid: "lines", layer: "mappings" });
  expect(layoutOf(await loadItems(ws, copyId))).toEqual(layoutOf(await loadItems(ws, original)));
  await expect(page.getByTestId("frame-canvas-look")).toHaveAttribute("data-bg", "blue");
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-grid", "lines");
  await expect(page.getByTestId("switch-layer").locator('[data-layer="mappings"]')).toHaveAttribute("aria-pressed", "true");
  // the model is shared: an entity renamed on the copy is renamed on the original
  await card(page, "Customer").getByTestId("card-name").click();
  await page.getByTestId("input-entity-name").fill("Client");
  await page.getByTestId("input-entity-name").press("Enter");
  await expect.poll(async () => (await loadModel()).entities.find((e) => e.id === entity("Customer").id)!.name).toBe("Client");
  await canvasTab(page, "Customer & orders").click();
  await expect(page).toHaveURL(new RegExp(`/c/${original}$`));
  await expect(card(page, "Client")).toBeVisible();

  // back on the copy: Ctrl+Z undoes the rename, then the duplicate; the original opens again (prototype)
  await canvasTab(page, "Customer & orders (copy)").click();
  await expect(page).toHaveURL(new RegExp(`/c/${copyId}$`));
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await key(page, "Control+z");
  await expectToast(page, "Undone: Rename entity");
  await key(page, "Control+z");
  await expectToast(page, "Undone: Duplicate canvas");
  await expect(page).toHaveURL(new RegExp(`/c/${original}$`));
  expect(await tabNames(page)).toEqual(["Customer & orders"]);
  expect(await store().canvases.get(ws, copyId)).toBeNull();
  expect(await loadItems(ws, copyId)).toEqual([]);
});
