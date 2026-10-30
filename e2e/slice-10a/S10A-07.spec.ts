import { expect, test } from "./fixtures";
import {
  archive,
  callActionDirectly,
  canvasUrl,
  captureActionId,
  card,
  closeToolbox,
  expectHidden,
  expectSelected,
  expectToast,
  groupsOf,
  ids,
  loadModel,
  menuOn,
  newSession,
  openCanvas,
  RETAIL,
  relationshipLine,
  relationshipsOf,
  signInAs,
  togglePanel,
  toolboxAt,
} from "./helpers";

// "Relate to itself" in an entity card header's menu (items 8 and 9, D-61); the new relationship is drawn as a loop.

const ADDED = "Relationship added. Name it and set the cardinality on the right.";
const SAME_CARD = "Pick a different entity, or use “Relate to itself” in the card's menu.";

test("S10A-07: Relate to itself creates one relationship with the entity at both ends, 0..1 → 0..n, one change group, its panel open from hidden, the toast; Ctrl+Z and Ctrl+Shift+Z", async ({ page }) => {
  const customer = (await ids()).entity("Customer");
  const before = await relationshipsOf(customer.id);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await togglePanel(page, "right");
  await expectHidden(page, "right");

  await menuOn(page, card(page, "Customer").locator(".c-head"), "Relate to itself");
  await expectToast(page, ADDED);
  await expect.poll(async () => (await relationshipsOf(customer.id)).length).toBe(before.length + 1);
  const made = (await relationshipsOf(customer.id)).find((r) => !before.some((b) => b.id === r.id))!;
  expect(made).toMatchObject({ from_entity_id: customer.id, to_entity_id: customer.id, label: null, from_min: 0, from_max: "1", to_min: 0, to_max: "n", version: 1 });
  expect(await groupsOf(made.id)).toHaveLength(1);
  // selected, and the hidden details panel opened (F13)
  await expect(page.getByTestId("button-toggle-right")).toHaveAttribute("aria-pressed", "true");
  await expectSelected(page, "relationship");
  await expect(page.getByTestId("panel-relationship").locator("h2")).toHaveText("Customer and Customer");
  await expect(relationshipLine(page, made.id)).toHaveCount(1);

  // one undo step, and redo brings it back
  await expect(page.getByTestId("button-undo")).toBeEnabled();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await relationshipsOf(customer.id)).some((r) => r.id === made.id)).toBe(false);
  await expect(page.getByTestId("button-redo")).toBeEnabled(); // Ctrl+Shift+Z does nothing until the page shows a redo
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(async () => (await relationshipsOf(customer.id)).some((r) => r.id === made.id)).toBe(true);
});

test("S10A-07: the relate button clicked on the same card shows the new toast and creates nothing", async ({ page }) => {
  const before = (await loadModel()).relationships.length;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await card(page, "Customer").getByTestId("button-card-relate").click();
  await card(page, "Customer").getByTestId("card-name").click();
  await expectToast(page, SAME_CARD);
  await page.waitForTimeout(500);
  expect((await loadModel()).relationships.length).toBe(before);
});

test("S10A-07: a reviewer has no Relate to itself and a direct call is refused; in an archived workspace the item is gone and the write is refused", async ({ browser }) => {
  const customer = (await ids()).entity("Customer");
  const owner = await newSession(browser, "Łukasz");
  await openCanvas(owner.page, canvasUrl());
  const headOf = async (p: typeof owner.page) => {
    const b = (await card(p, "Customer").locator(".c-head").boundingBox())!;
    return { x: b.x + 30, y: b.y + b.height / 2 };
  };
  expect(await toolboxAt(owner.page, await headOf(owner.page))).toContain("Relate to itself");
  await closeToolbox(owner.page);
  const actionId = await captureActionId(owner.page, () => menuOn(owner.page, card(owner.page, "Customer").locator(".c-head"), "Relate to itself"));
  await expectToast(owner.page, ADDED);
  await expect.poll(async () => (await relationshipsOf(customer.id)).filter((r) => r.to_entity_id === r.from_entity_id).length).toBe(1);
  const args = [RETAIL, { fromEntityId: customer.id, toEntityId: customer.id }];
  const selfCount = async () => (await relationshipsOf(customer.id)).filter((r) => r.to_entity_id === r.from_entity_id).length;

  // Piotr, a reviewer: no item, and the server refuses the call
  const reviewer = await newSession(browser, "Piotr Wiśniewski");
  await openCanvas(reviewer.page, canvasUrl());
  expect(await toolboxAt(reviewer.page, await headOf(reviewer.page))).not.toContain("Relate to itself");
  await closeToolbox(reviewer.page);
  await callActionDirectly(reviewer.page, actionId, args);
  expect(await selfCount()).toBe(1);
  await reviewer.context.close();

  // archived: no item for the owner either, and the server refuses
  await archive();
  await openCanvas(owner.page, canvasUrl());
  expect(await toolboxAt(owner.page, await headOf(owner.page))).not.toContain("Relate to itself");
  await closeToolbox(owner.page);
  await callActionDirectly(owner.page, actionId, args);
  expect(await selfCount()).toBe(1);
  await owner.context.close();
});
