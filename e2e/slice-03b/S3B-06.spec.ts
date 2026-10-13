import { expect, test } from "./fixtures";
import {
  card,
  cardEl,
  expectCard,
  expectToast,
  ids,
  labelsField,
  liveCards,
  liveUrl,
  loadModel,
  openCanvas,
  openLiveFor,
  RETAIL,
  rowNamed,
  signInAs,
  store,
  typeLabel,
  undo,
} from "./helpers";

// An attribute panel opens only for a card on the canvas, so the element brought in here is a table: the mapping panel
// of Customer.customer_id labels its mapping from customers, a table not on the live canvas (acceptance doc, step 5).
test("S3B-06: with the live canvas open, labeling in a panel brings the element as context to the right of the content with the toast; a context element labeled directly becomes full and its filter all; removing its last label takes it off; each in the change's undo step", async ({ page }) => {
  test.setTimeout(150_000);
  const { attribute, table } = await ids();
  const live = await openLiveFor("CR-23");
  const customers = table("customers").id;
  const before = await liveCards(live);
  expect(before.some(([id]) => id === customers)).toBe(false);

  await signInAs(page, "Łukasz");
  await openCanvas(page, liveUrl(live), { x: -200, y: 0, zoom: 0.8 });
  await expectCard(page, "Customer");

  // label the mapping customers.cust_id → Customer.customer_id: customers comes as context, to the right of the content
  const customerId = attribute("Customer", "customer_id");
  expect((await loadModel()).mappings.some((m) => m.attribute_id === customerId.id)).toBe(true);
  await rowNamed(page, "Customer", "customer_id").click();
  await page.getByTestId("list-attribute-mappings").getByRole("button").first().click();
  await expect(page.getByTestId("panel-mapping")).toBeVisible();
  await typeLabel(page, "CR-23");
  await page.keyboard.press("Enter");
  await expectToast(page, "Added from CR-23: customers.");
  await expect.poll(() => liveCards(live)).toContainEqual([customers, "context", "labeled"]);
  const items = await store().canvasItems.listOfCanvas(RETAIL, live);
  const others = items.filter((i) => i.source_table_id !== customers);
  const added = items.find((i) => i.source_table_id === customers)!;
  expect(added.x).toBeGreaterThan(Math.max(...others.map((i) => i.x + (i.width ?? 256))));
  expect(added.frame_id).toBeNull();
  await expectCard(page, "customers");

  // customers labeled directly: full, filter all; one undo makes it context again
  await card(page, "customers").getByTestId("card-name").click();
  await typeLabel(page, "CR-23");
  await page.keyboard.press("Enter");
  await expect.poll(() => liveCards(live)).toContainEqual([customers, "full", "all"]);
  await expect(cardEl(page, "customers")).toHaveAttribute("data-live", "full");
  await undo(page);
  await expect.poll(() => liveCards(live)).toContainEqual([customers, "context", "labeled"]);

  // the mapping's label taken off: customers carries CR-23 nowhere any more and leaves, with the toast; undo brings it back
  await rowNamed(page, "Customer", "customer_id").click();
  await page.getByTestId("list-attribute-mappings").getByRole("button").first().click();
  await labelsField(page).getByTestId("chip-label").filter({ hasText: "CR-23" }).getByTestId("button-label-remove").click();
  await expectToast(page, "No longer labeled: customers.");
  await expect.poll(async () => (await liveCards(live)).some(([id]) => id === customers)).toBe(false);
  await expectCard(page, "customers", 0);
  await undo(page);
  await expect.poll(() => liveCards(live)).toContainEqual([customers, "context", "labeled"]);
});
