import { placeOnCanvas } from "../../src/domain/commands/canvas-item";
import { expect, test, type Page } from "./fixtures";
import { asLukasz, box, canvasUrl, card, ids, LEFT_AT_100, lineEnds, loadModel, mappingLine, openCanvas, RETAIL, rowNamed, SEED_IDS, signInAs, store } from "./helpers";

/** Customer's attribute names in model order. */
const modelOrder = async (customerId: string) =>
  (await loadModel()).attributes
    .filter((a) => a.entity_id === customerId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a) => a.name);
/** Customer's attribute names as its card shows them. */
const cardOrder = (page: Page) => card(page, "Customer").locator(".row[data-row] .nm").evaluateAll((els) => els.map((e) => e.getAttribute("title")));

test("S1B-08: Ctrl+↑ moves an attribute up, Ctrl+Shift+↓ to the bottom; panel drag reorders; lines follow; the order is the same on every canvas and after reload", async ({ page }) => {
  const { entity, model, attribute, column } = await ids();
  const customer = entity("Customer");
  expect(await modelOrder(customer.id)).toEqual(["customer_id", "customer_number", "first_name", "last_name", "email", "birth_date", "segment_code", "created_at"]);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), LEFT_AT_100);

  // Ctrl+↑ on email: one place up; the moved row flashes
  await rowNamed(page, "Customer", "email").click();
  await page.keyboard.press("Control+ArrowUp");
  await expect(page.getByTestId("row-moved")).toHaveCount(1);
  const up = ["customer_id", "customer_number", "first_name", "email", "last_name", "birth_date", "segment_code", "created_at"];
  await expect.poll(() => modelOrder(customer.id)).toEqual(up);
  await expect.poll(() => cardOrder(page)).toEqual(up);

  // the email line (from customers.email_addr) ends at the email row where it is now
  const emailAddr = column("customers", "email_addr");
  const emailMapping = model.mappings.find(
    (m) => m.attribute_id === attribute("Customer", "email").id && model.mappingInputs.some((i) => i.mapping_id === m.id && i.source_column_id === emailAddr.id),
  )!;
  const row = await box(rowNamed(page, "Customer", "email"));
  await expect.poll(async () => Math.abs((await lineEnds(mappingLine(page, emailMapping.id).first()))[0]!.end.y - (row.y + row.height / 2))).toBeLessThan(1.5);

  // Ctrl+Shift+↓: to the bottom
  await page.keyboard.press("Control+Shift+ArrowDown");
  const bottom = ["customer_id", "customer_number", "first_name", "last_name", "birth_date", "segment_code", "created_at", "email"];
  await expect.poll(() => modelOrder(customer.id)).toEqual(bottom);
  await expect.poll(() => cardOrder(page)).toEqual(bottom);

  // dragging in the entity panel's attribute list: created_at onto the upper half of customer_id → first
  await card(page, "Customer").getByTestId("card-name").click();
  const items = page.getByTestId("attribute-order-item");
  const target = await box(items.filter({ hasText: "customer_id" }));
  await items.filter({ hasText: "created_at" }).dragTo(items.filter({ hasText: "customer_id" }), { targetPosition: { x: 40, y: target.height / 4 } });
  const dragged = ["created_at", "customer_id", "customer_number", "first_name", "last_name", "birth_date", "segment_code", "email"];
  await expect.poll(() => modelOrder(customer.id)).toEqual(dragged);
  await expect.poll(() => cardOrder(page)).toEqual(dragged);

  // after a reload, and on another canvas (Customer placed on “Order lines & products”), the same order
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect.poll(() => cardOrder(page)).toEqual(dragged);
  const canvas = (await store().canvases.get(RETAIL, SEED_IDS.canvasOrderLines))!;
  const cards = await store().canvasItems.listOfCanvas(RETAIL, canvas.id);
  await asLukasz((ctx, access) =>
    placeOnCanvas(ctx, access, { canvas, entity: customer, sourceTable: null, items: cards }, { canvasId: canvas.id, entityId: customer.id, x: 900, y: 40 }),
  );
  await openCanvas(page, canvasUrl(SEED_IDS.canvasOrderLines, SEED_IDS.projOrderManagement), { x: -400, y: 0, zoom: 1 });
  await expect.poll(() => cardOrder(page)).toEqual(dragged);
});
