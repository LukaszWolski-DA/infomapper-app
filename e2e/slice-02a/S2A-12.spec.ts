import { placeOnCanvas } from "../../src/domain/commands/canvas-item";
import { expect, test } from "./fixtures";
import { asLukasz, box, canvasIn, card, expectToast, ids, loadItems, openCanvas, SEED_IDS, signInAs, store, WHOLE } from "./helpers";

test("S2A-12: Customer's “On canvases” lists both canvases it is on (the test places it on a second canvas in another project); a click opens the other canvas in its project with Customer selected and in view", async ({ page }) => {
  const ws = SEED_IDS.wsRetailDwh, c360 = SEED_IDS.projCustomer360, om = SEED_IDS.projOrderManagement;
  const lines = SEED_IDS.canvasOrderLines;
  const { entity } = await ids();
  const customer = entity("Customer");
  // Order lines & products is only in Order management; Customer goes there, far from the other cards
  const canvas = (await store().canvases.get(ws, lines))!;
  await asLukasz((ctx, access) =>
    placeOnCanvas(ctx, access, { canvas, entity: customer, sourceTable: null, items: [] }, { canvasId: lines, entityId: customer.id, x: 1600, y: 1200 }),
  );
  const placed = (await loadItems(ws, lines)).find((i) => i.entity_id === customer.id)!;

  await signInAs(page, "Łukasz");
  // Order lines & products remembers a view far away from Customer
  await openCanvas(page, canvasIn(om, lines), { x: 0, y: 0, zoom: 1 });
  await openCanvas(page, canvasIn(c360, SEED_IDS.canvasCustomerOrders), WHOLE);
  await card(page, "Customer").getByTestId("card-name").click();
  const list = page.getByTestId("list-on-canvases").getByTestId("item-on-canvas");
  await expect(list).toHaveCount(2);
  expect(await list.allInnerTexts()).toEqual(["Customer & orders\nthis canvas", "Order lines & products\nin Order management"]);
  // a source table too: order_line is on both canvases
  await card(page, "order_line").getByTestId("card-name").click();
  await expect(page.getByTestId("panel-source-table")).toBeVisible();
  expect(await list.allInnerTexts()).toEqual(["Customer & orders\nthis canvas", "Order lines & products\nin Order management"]);

  // a click opens the other canvas in its project, with Customer selected and in view
  await card(page, "Customer").getByTestId("card-name").click();
  await list.filter({ hasText: "Order lines & products" }).click();
  await expectToast(page, "Switched to the project Order management.");
  await expect(page).toHaveURL(new RegExp(`/p/${om}/c/${lines}$`)); // the address keeps no query
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Customer");
  await expect.poll(async () => {
    const pane = await box(page.locator(".react-flow__pane"));
    const c = await box(page.locator(`.react-flow__node[data-id="${placed.id}"]`));
    return c.x >= pane.x && c.y >= pane.y && c.x + c.width <= pane.x + pane.width && c.y < pane.y + pane.height;
  }).toBe(true);
  await expect(page.getByTestId("list-on-canvases").getByTestId("item-on-canvas").filter({ hasText: "Order lines & products" })).toContainText("this canvas");
  await expect(page.getByTestId("list-on-canvases").getByTestId("item-on-canvas").filter({ hasText: "Customer & orders" })).toContainText("open");
});
