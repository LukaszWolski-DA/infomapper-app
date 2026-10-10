import { expect, test } from "./fixtures";
import {
  AROUND,
  bundles,
  bundleWithCount,
  canvasUrl,
  collapsedFrame,
  lineLayer,
  mappingId,
  mappingLines,
  openCanvas,
  relBundle,
  signInAs,
  FRAMED,
} from "./helpers";

test("S2C-06: with two frames collapsed, the lines between them are one bundle with the right count; relationship bundles show “N relationships”; layer mode hides the matching bundles", async ({ page }) => {
  // Tables: customers, web_users, order_header. Ends: Customer and Order Line (Sales Order between them stays drawn).
  await collapsedFrame(AROUND.tables, { name: "Tables" });
  await collapsedFrame(AROUND.customerAndLine, { name: "Ends" });
  const orders = await mappingId("order_header.ord_id", "Sales Order.order_id");
  const itemCode = await mappingId("order_line.item_code", "Order Line.product_id");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);

  // Tables → Ends: customers' seven and web_users.email, all into Customer: one bundle of 8, from block to block
  const eight = bundleWithCount(page, 8);
  await expect(eight).toHaveCount(1);
  await expect(eight).toHaveAttribute("data-bundle", /^m\|f:[^|]+\|f:[^|]+$/);
  await expect(eight).not.toHaveClass(/\bdraft\b/);
  await expect(eight).not.toHaveClass(/\bwarn\b/);
  // Tables → Sales Order: one line per attribute; order_line (in no frame) → Ends: a line of its own
  await expect(mappingLines(page, orders)).toHaveCount(1);
  await expect(mappingLines(page, itemCode)).toHaveCount(1);
  // Ends ↔ Sales Order: “places” and “contains”, one line with the count; no relationship line of its own
  const rels = relBundle(page, "2 relationships");
  await expect(rels).toHaveCount(1);
  await expect(lineLayer(page).getByTestId("line-relationship")).toHaveCount(0);
  await expect(bundles(page)).toHaveCount(2);

  // layer mode: Mappings hides the relationship bundle, Relationships the mapping bundles and lines
  const layer = page.getByTestId("switch-layer");
  await layer.locator('[data-layer="mappings"]').click();
  await expect(rels).toHaveCount(0);
  await expect(eight).toHaveCount(1);
  await layer.locator('[data-layer="relationships"]').click();
  await expect(eight).toHaveCount(0);
  await expect(mappingLines(page, orders)).toHaveCount(0);
  await expect(rels).toHaveCount(1);
  await layer.locator('[data-layer="all"]').click();
  await expect(eight).toHaveCount(1);
  await expect(rels).toHaveCount(1);
});

test("S2C-06: a bundle between two blocks counts every mapping between them, into all their cards", async ({ page }) => {
  // People: Customer and Sales Order. Tables → People: 8 into Customer and order_header's 5 into Sales Order.
  await collapsedFrame(AROUND.tables, { name: "Tables" });
  await collapsedFrame(AROUND.customerAndSales, { name: "People" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  await expect(bundleWithCount(page, 13)).toHaveCount(1);
  // “Customer places Sales Order” is inside People: not drawn; “contains” is People ↔ Order Line
  await expect(relBundle(page, "1 relationship")).toHaveCount(1);
  await expect(bundles(page)).toHaveCount(2);
});
