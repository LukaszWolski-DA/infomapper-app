import { expect, test } from "./fixtures";
import { canvasIn, expectToast, ids, key, loadItems, loadModel, openCanvas, openCanvasMenu, SEED_IDS, signInAs, store, tabNames } from "./helpers";

test("S2A-09: a canvas that is also in another project is only removed from this one; a canvas in one project is deleted with its cards and its entities stay in the model; the project's last canvas cannot be deleted; Ctrl+Z restores a deleted canvas with its cards", async ({ page }) => {
  const ws = SEED_IDS.wsRetailDwh;
  const { customer360: c360, orders: om } = { customer360: SEED_IDS.projCustomer360, orders: SEED_IDS.projOrderManagement };
  const both = SEED_IDS.canvasCustomerOrders, lines = SEED_IDS.canvasOrderLines;
  const { entity } = await ids();
  const linesItems = await loadItems(ws, lines);
  const projectsOf = async (canvasId: string) => (await store().canvases.listLinksOfCanvas(ws, canvasId)).map((l) => l.project_id).sort();

  await signInAs(page, "Łukasz");

  // Customer 360 has one canvas: its last item is there, but disabled
  await openCanvas(page, canvasIn(c360, both));
  let menu = await openCanvasMenu(page, "Customer & orders");
  await expect(menu.getByTestId("menu-item-delete-canvas")).toHaveText("Remove from this project");
  await expect(menu.getByTestId("menu-item-delete-canvas")).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");

  // in Order management: Order lines & products is only there, so it is deleted, with its cards; the model stays
  await openCanvas(page, canvasIn(om, lines));
  menu = await openCanvasMenu(page, "Order lines & products");
  await expect(menu.getByTestId("menu-item-delete-canvas")).toHaveText("Delete canvas");
  await menu.getByTestId("menu-item-delete-canvas").click();
  await expectToast(page, "Deleted the canvas Order lines & products. The model and its mappings are untouched.");
  await expect(page).toHaveURL(new RegExp(`/p/${om}/c/${both}$`)); // the open canvas went: the next one opens
  expect(await tabNames(page)).toEqual(["Customer & orders"]);
  expect(await store().canvases.get(ws, lines)).toBeNull();
  expect(await loadItems(ws, lines)).toEqual([]);
  expect((await loadModel()).entities.some((e) => e.id === entity("Product").id)).toBe(true);

  // now the project's last canvas cannot be deleted either
  menu = await openCanvasMenu(page, "Customer & orders");
  await expect(menu.getByTestId("menu-item-delete-canvas")).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");

  // Ctrl+Z, from the canvas that opened, restores the canvas with its cards and its tab
  await key(page, "Control+z");
  await expectToast(page, /^Undone: Delete canvas/);
  await expect.poll(() => tabNames(page)).toEqual(["Customer & orders", "Order lines & products"]);
  expect((await loadItems(ws, lines)).map((i) => i.id).sort()).toEqual(linesItems.map((i) => i.id).sort());

  // Customer & orders is also in Customer 360: from Order management it is only taken out of this project
  menu = await openCanvasMenu(page, "Customer & orders");
  await expect(menu.getByTestId("menu-item-delete-canvas")).toHaveText("Remove from this project");
  const cardsBefore = await loadItems(ws, both);
  await menu.getByTestId("menu-item-delete-canvas").click();
  await expectToast(page, "Took Customer & orders out of Order management. It is still in Customer 360.");
  await expect(page).toHaveURL(new RegExp(`/p/${om}/c/${lines}$`));
  expect(await projectsOf(both)).toEqual([c360]);
  expect(await store().canvases.get(ws, both)).not.toBeNull();
  expect(await loadItems(ws, both)).toEqual(cardsBefore);

  // its old address in Order management opens the project's first canvas and says so
  await page.goto(canvasIn(om, both));
  await expect(page).toHaveURL(new RegExp(`/p/${om}/c/${lines}$`));
  await expectToast(page, "This canvas is no longer in Order management. Opened Order lines & products.");
});
