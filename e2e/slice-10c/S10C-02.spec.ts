import { SEED_IDS } from "../../src/data/local/seed";
import { expect, test } from "./fixtures";
import { attributesOf, canvasUrl, closeToolbox, copyRow, expectToast, headOf, openCanvas, pasteOn, signInAs, toolboxAt } from "./helpers";
import { canvasTab } from "../slice-02a/helpers";

// The same entity, pasting again, and the clipboard's life (items 3, 4; F12, F13).

const PASTE = "Paste attribute “customer_id”";
const menuOfHead = async (page: import("@playwright/test").Page, cardName: string) => {
  const b = (await headOf(page, cardName).boundingBox())!;
  const items = await toolboxAt(page, { x: b.x + 30, y: b.y + b.height / 2 });
  await closeToolbox(page);
  return items;
};

test("S10C-02: a key pasted into its own entity and into two more; the clipboard survives switching canvases and not a reload", async ({ page }) => {
  await signInAs(page, "Łukasz");
  // both canvases are tabs of “Order management”
  const url = canvasUrl(SEED_IDS.canvasCustomerOrders, SEED_IDS.projOrderManagement);
  await openCanvas(page, url);
  expect((await menuOfHead(page, "Customer")).some((i) => i.startsWith("Paste attribute"))).toBe(false);

  await copyRow(page, "Customer", "customer_id");
  // its own entity: a second customer_id, the toast says the name is taken
  await pasteOn(page, "Customer", "customer_id");
  await expectToast(page, "Pasted “customer_id” into Customer, which already has an attribute of that name.");
  await expect.poll(async () => (await attributesOf("Customer")).filter((a) => a.name === "customer_id").length).toBe(2);
  // the same clipboard into two more entities
  await pasteOn(page, "Sales Order", "customer_id");
  await expectToast(page, "Pasted “customer_id” into Sales Order, which already has an attribute of that name.");
  await pasteOn(page, "Order Line", "customer_id");
  await expectToast(page, "Pasted “customer_id” into Order Line.");
  await expect.poll(async () => (await attributesOf("Order Line")).filter((a) => a.name === "customer_id").length).toBe(1);

  // another canvas, by its tab: the clipboard is still there
  await canvasTab(page, "Order lines & products").click();
  await expect(page).toHaveURL(new RegExp(SEED_IDS.canvasOrderLines));
  expect(await menuOfHead(page, "Product")).toContain(PASTE);

  // a reload empties it
  await page.reload();
  expect((await menuOfHead(page, "Product")).some((i) => i.startsWith("Paste attribute"))).toBe(false);
});
