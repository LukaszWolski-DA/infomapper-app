import { RETAIL } from "../slice-01a/helpers";
import { archive } from "../slice-07a/helpers";
import { expect, test } from "./fixtures";
import {
  attributeOf,
  attributesOf,
  callActionDirectly,
  canvasUrl,
  captureActionId,
  closeToolbox,
  copyRow,
  deleteAs,
  expectToast,
  headOf,
  newSession,
  openCanvas,
  pasteOn,
  rowNamed,
  signInAs,
  toolboxAt,
} from "./helpers";

// Refusals and rights (item 4, AD-05, AD-09): a deleted original, a reviewer, an archived workspace.

const menuAt = async (page: import("@playwright/test").Page, target: import("@playwright/test").Locator) => {
  const b = (await target.boundingBox())!;
  const items = await toolboxAt(page, { x: b.x + 30, y: b.y + b.height / 2 });
  await closeToolbox(page);
  return items;
};

test("S10C-08: pasting after the original was deleted elsewhere is refused and empties the clipboard", async ({ page }) => {
  const original = await attributeOf("Customer", "customer_id");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await copyRow(page, "Customer", "customer_id");
  await deleteAs(original.id); // another session
  await pasteOn(page, "Order Line", "customer_id");
  await expectToast(page, "The copied attribute no longer exists.");
  expect((await menuAt(page, headOf(page, "Order Line"))).some((i) => i.startsWith("Paste attribute"))).toBe(false);
  expect((await attributesOf("Order Line")).some((a) => a.name === "customer_id")).toBe(false);
});

test("S10C-08: a reviewer has no Copy and no paste item and a direct call is refused; in an archived workspace the paste is refused", async ({ browser }) => {
  const original = await attributeOf("Customer", "customer_id");
  const owner = await newSession(browser, "Łukasz");
  await openCanvas(owner.page, canvasUrl());
  await copyRow(owner.page, "Customer", "customer_id");
  const actionId = await captureActionId(owner.page, () => pasteOn(owner.page, "Order Line", "customer_id"));
  await expect.poll(async () => (await attributesOf("Order Line")).filter((a) => a.name === "customer_id").length).toBe(1);
  const lineEntity = (await attributesOf("Order Line"))[0]!.entity_id;
  const args = [RETAIL, { entityId: lineEntity, attributeId: original.id }];
  const copies = async () => (await attributesOf("Order Line")).filter((a) => a.name === "customer_id").length;

  const reviewer = await newSession(browser, "Piotr Wiśniewski");
  await openCanvas(reviewer.page, canvasUrl());
  expect(await menuAt(reviewer.page, rowNamed(reviewer.page, "Customer", "customer_id"))).not.toContain("Copy");
  expect((await menuAt(reviewer.page, headOf(reviewer.page, "Order Line"))).some((i) => i.startsWith("Paste attribute"))).toBe(false);
  await callActionDirectly(reviewer.page, actionId, args);
  expect(await copies()).toBe(1);
  await reviewer.context.close();

  await archive();
  await callActionDirectly(owner.page, actionId, args);
  expect(await copies()).toBe(1);
  await owner.context.close();
});
