import { blockHeight } from "../../src/domain/model/frames";
import { expect, test } from "./fixtures";
import {
  AROUND,
  blockEl,
  canvasUrl,
  collapsedFrame,
  dragBetween,
  expectToast,
  frameNamed,
  headPoint,
  item,
  loadModel,
  openCanvas,
  screenPoint,
  signInAs,
  FRAMED,
} from "./helpers";

test("S2C-04: a card dropped on a block joins the frame at its bottom, the frame grows, the toast names both; the other cards stay where they are", async ({ page }) => {
  const area = await collapsedFrame(AROUND.customers, { name: "Area" }); // customers in it; the block at 0, 0
  const before = (await frameNamed("Area"))!;
  const orderHeader0 = await item("order_header");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);

  // web_users dragged by its header onto the middle of the block
  await dragBetween(page, await headPoint(page, "web_users"), await screenPoint(page, { x: 100, y: blockHeight(1) / 2 }));
  await expectToast(page, "web_users added to the collapsed frame Area.");
  await expect.poll(async () => (await item("web_users")).frame_id).toBe(area);
  const web = await item("web_users");
  // filed at the frame's bottom: x = frame's x + 32, y = frame's bottom − 8 (snapped to 8 px)
  expect({ x: web.x, y: web.y }).toEqual({ x: before.x + 32, y: Math.round((before.y + before.height - 8) / 8) * 8 });
  // the frame grew to hold it
  const after = (await frameNamed("Area"))!;
  expect(after.collapsed).toBe(true);
  expect(after.y + after.height).toBeGreaterThanOrEqual(web.y + web.height);
  expect(after.height).toBeGreaterThan(before.height);
  // the block counts it; the card is hidden with the others
  await expect(blockEl(page, "Area").getByTestId("block-count")).toHaveText("collapsed, 2 cards");
  // no other card was claimed or moved
  const orderHeader = await item("order_header");
  expect({ x: orderHeader.x, y: orderHeader.y, f: orderHeader.frame_id }).toEqual({ x: orderHeader0.x, y: orderHeader0.y, f: null });
});

test("S2C-04: an entity of another concept dropped on a concept frame's block asks the concept question first", async ({ page }) => {
  const frame = await collapsedFrame(AROUND.customer, { name: "Customer", concept: "Customer" });
  const model = await loadModel();
  const ol = model.entities.find((e) => e.name === "Order Line")!;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);

  await dragBetween(page, await headPoint(page, "Order Line"), await screenPoint(page, { x: 580, y: blockHeight(1) / 2 }));
  const ask = page.getByTestId("dialog-concept-question");
  await expect(ask).toBeVisible();
  await expect(page.getByTestId("text-concept-question")).toContainText("Order Line");
  await expect(page.getByTestId("text-concept-question")).toContainText("Customer");
  // “Move” is saved in the same change as the drop
  await page.getByTestId("button-concept-move").click();
  await expect.poll(async () => (await item("Order Line")).frame_id).toBe(frame);
  const customer = model.concepts.find((c) => c.name === "Customer")!;
  await expect.poll(async () => (await loadModel()).entities.find((e) => e.id === ol.id)!.concept_id).toBe(customer.id);
  await expect(blockEl(page, "Customer").getByTestId("block-count")).toHaveText("collapsed, 2 cards");
});
