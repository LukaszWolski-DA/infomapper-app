import { blockHeight } from "../../src/domain/model/frames";
import { expect, test } from "./fixtures";
import {
  AROUND,
  bundles,
  bundleWithCount,
  canvasUrl,
  collapsedFrame,
  key,
  lineLayer,
  loadModel,
  mappingId,
  mappingLines,
  openCanvas,
  pointOnLine,
  screenPoint,
  signInAs,
  FRAMED,
} from "./helpers";

/** customers' seven mappings, each into its own attribute of Customer. */
const CRM_MAPPINGS = [
  ["customers.cust_id", "Customer.customer_id"],
  ["customers.cust_no", "Customer.customer_number"],
  ["customers.fname", "Customer.first_name"],
  ["customers.lname", "Customer.last_name"],
  ["customers.email_addr", "Customer.email"],
  ["customers.dob", "Customer.birth_date"],
  ["customers.created_ts", "Customer.created_at"],
] as const;

test("S2C-05: with the source frame CRM collapsed, its mappings are one line per attribute, from the block; a single mapping keeps its status style, its chip and its selection, and can be deleted", async ({ page }) => {
  await collapsedFrame(AROUND.customers, { name: "CRM", system: "CRM" });
  const ids = await Promise.all(CRM_MAPPINGS.map(([c, a]) => mappingId(c, a)));
  const web = await mappingId("web_users.email", "Customer.email");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);

  // seven lines, one per attribute; no count chip; web_users' own line as before
  for (const id of ids) await expect(mappingLines(page, id)).toHaveCount(1);
  await expect(bundles(page)).toHaveCount(0);
  await expect(lineLayer(page).getByTestId("chip-count")).toHaveCount(0);
  await expect(mappingLines(page, web)).toHaveCount(1);
  // each starts at the middle of the block's right side (the block: 0, 0, 280 wide)
  const start = await screenPoint(page, { x: 280, y: blockHeight(1) / 2 });
  for (const id of ids) {
    const p = await pointOnLine(mappingLines(page, id), 0);
    expect(Math.abs(p.x - start.x)).toBeLessThan(2);
    expect(Math.abs(p.y - start.y)).toBeLessThan(2);
  }
  // status style and chips: birth_date is in review, created_at a transform with its ƒ chip
  const [, , , , , dob, created] = ids;
  await expect(mappingLines(page, dob!)).toHaveClass(/\breview\b/);
  await expect(mappingLines(page, ids[0]!)).toHaveClass(/\bapproved\b/);
  await expect(mappingLines(page, created!).getByTestId("node-f")).toHaveCount(1);

  // selectable as a mapping: its panel; Delete deletes it
  const on = await pointOnLine(mappingLines(page, dob!), 0.7);
  await page.mouse.click(on.x, on.y);
  await expect(page.getByTestId("panel-mapping")).toBeVisible();
  await expect(mappingLines(page, dob!)).toHaveClass(/\bsel\b/);
  await key(page, "Delete");
  await expect.poll(async () => (await loadModel()).mappings.some((m) => m.id === dob)).toBe(false);
  await expect(mappingLines(page, dob!)).toHaveCount(0);
});

test("S2C-05: two or more mappings between the same ends are one line with a count chip; a frame's own lines are not drawn", async ({ page }) => {
  // the three tables on the left in one collapsed frame: customers.email_addr and web_users.email both fill Customer.email
  await collapsedFrame(AROUND.tables, { name: "Tables" });
  const email = [await mappingId("customers.email_addr", "Customer.email"), await mappingId("web_users.email", "Customer.email")];
  const orders = await mappingId("order_header.ord_id", "Sales Order.order_id");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);

  const two = bundleWithCount(page, 2);
  await expect(two).toHaveCount(1);
  await expect(two.getByTestId("chip-count")).toHaveText("2");
  await expect(two).not.toHaveClass(/\bdraft\b/); // one of the two is approved
  for (const id of email) await expect(mappingLines(page, id)).toHaveCount(0);
  // every other attribute has a line of its own
  await expect(bundles(page)).toHaveCount(1);
  await expect(mappingLines(page, orders)).toHaveCount(1);
});

test("S2C-05: lines with both ends inside the same collapsed frame are not drawn", async ({ page }) => {
  await collapsedFrame(AROUND.customersAndCustomer, { name: "Both" });
  const ids = await Promise.all(CRM_MAPPINGS.map(([c, a]) => mappingId(c, a)));
  const web = await mappingId("web_users.email", "Customer.email");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  await expect(mappingLines(page, web)).toHaveCount(1); // from web_users' row to the block
  for (const id of ids) await expect(mappingLines(page, id)).toHaveCount(0);
  // no mapping bundle; the only bundle is “Customer places Sales Order”, from the block to Sales Order
  await expect(lineLayer(page).locator('[data-testid="line-bundle"][data-count]')).toHaveCount(0);
  await expect(bundles(page)).toHaveText(["1 relationship"]);
});
