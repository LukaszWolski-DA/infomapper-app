import { removeFromCanvas } from "../../src/domain/commands/canvas-item";
import { createMapping } from "../../src/domain/commands/mapping";
import { expect, test, type Page } from "./fixtures";
import { asLukasz, box, canvasUrl, card, expectToast, ids, loadItems, loadModel, openCanvas, signInAs, type Box } from "./helpers";

/** The boxes of every card on the screen. */
const cardBoxes = async (page: Page): Promise<{ name: string; b: Box }[]> => {
  const out: { name: string; b: Box }[] = [];
  for (const node of await page.locator(".react-flow__node").all()) {
    out.push({ name: (await node.getByTestId("card-name").innerText()).trim(), b: await box(node.locator("[data-card]")) });
  }
  return out;
};
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function expectNoOverlaps(page: Page) {
  const boxes = await cardBoxes(page);
  for (const [i, a] of boxes.entries()) {
    for (const b of boxes.slice(i + 1)) expect(overlap(a.b, b.b), `${a.name} and ${b.name} overlap`).toBe(false);
  }
}

test("S1B-11: “Add the N missing to this canvas” places Customer's missing sources to the left of its card without overlaps", async ({ page }) => {
  const { model, entity, table, attribute, column } = await ids();
  const customer = entity("Customer"), salesOrder = entity("Sales Order");
  // test data: order_header also feeds Customer (cust_ref → customer_number), so Customer has three feeding sources;
  // customers, web_users and Sales Order are taken off the canvas
  const custRef = column("order_header", "cust_ref"), number = attribute("Customer", "customer_number");
  await asLukasz((ctx, access) =>
    createMapping(ctx, access, { attribute: number, column: custRef, mappings: model.mappings, mappingInputs: model.mappingInputs }, { attributeId: number.id, sourceColumnId: custRef.id }),
  );
  const items = await loadItems();
  for (const item of items.filter((i) => [table("customers").id, table("web_users").id].includes(i.source_table_id!) || i.entity_id === salesOrder.id)) {
    await asLukasz((ctx, access) => removeFromCanvas(ctx, access, { item }, { canvasItemId: item.id, expectedVersion: item.version }));
  }

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: 300, y: 40, zoom: 0.6 });
  await card(page, "Customer").getByTestId("card-name").click();
  const panel = page.getByTestId("panel-entity");
  await expect(panel.getByTestId("button-feed-all")).toHaveText("Add the 2 missing to this canvas");
  await panel.getByTestId("button-feed-all").click();
  await expectToast(page, "Added 2 source tables next to the selection.");

  // left of Customer, 160 px apart, from its top down, without overlaps
  const after = await loadItems();
  const at = (id: string) => after.find((i) => i.source_table_id === id || i.entity_id === id)!;
  const c = at(customer.id);
  for (const t of ["customers", "web_users"]) expect(at(table(t).id).x, t).toBe(c.x - 256 - 160);
  expect(at(table("customers").id).y).toBe(c.y);
  await expect(card(page, "customers")).toBeVisible();
  await expect(card(page, "web_users")).toBeVisible();
  await expectNoOverlaps(page);
  await expect(panel.getByTestId("button-feed-all")).toHaveCount(0);

  // fed entities of a table go to its right: a single one clicked in the source table panel is placed there too
  await card(page, "order_header").getByTestId("card-name").click();
  const tablePanel = page.getByTestId("panel-source-table");
  await expect(tablePanel.getByTestId("button-feed-all")).toHaveText("Add the 1 missing to this canvas");
  await tablePanel.getByRole("button").filter({ has: page.getByText("Sales Order", { exact: true }) }).click();
  await expectToast(page, "Added 1 entity next to the selection.");
  const placed = (await loadItems()).find((i) => i.entity_id === salesOrder.id)!;
  const header = (await loadItems()).find((i) => i.source_table_id === table("order_header").id)!;
  expect(placed.x).toBe(header.x + 256 + 160);
  await expect(card(page, "Sales Order")).toBeVisible();
  await expectNoOverlaps(page);
  expect((await loadModel()).entities.length).toBe(model.entities.length);
});
