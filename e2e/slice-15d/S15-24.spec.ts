import { expect, test } from "./fixtures";
import { attrId, conceptRows, cubeMappingId, hydrated, ids, liveCubeMappings, openAttribute, openEntity, openStar, signInAs, undoButton } from "./helpers";

// S15-24 (section 0, "Before 15d"; D14, D-70): "Fed from concepts" in a fact's and a dimension's panel, where a logical
// entity has "Feeding sources": the concepts of the logical entities that feed it, each with how many of its attributes
// they feed (mappings in any status), in the concepts' order; nothing for an entity without feeds. A new feed from
// another concept adds a row; its undo takes it away.

test("S15-24: Fed from concepts on Fact Sales, Dim Customer and Dim Date; a new feed from another concept, and its undo", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);

  await openEntity(page, "Fact Sales");
  await expect(page.getByText("Feeding sources")).toHaveCount(0);
  await expect.poll(() => conceptRows(page)).toEqual([{ text: "Sales 8 attributes", title: "From Order Line and Sales Order (mappings in any status)" }]);

  await openEntity(page, "Dim Customer");
  await expect.poll(() => conceptRows(page)).toEqual([
    { text: "Customer 3 attributes", title: "From Customer and Customer Address (mappings in any status)" },
    { text: "Reference data 1 attribute", title: "From Country (mappings in any status)" },
  ]);

  await openEntity(page, "Dim Date");
  await expect(page.getByTestId("fold-cube-fed-from-concepts")).toContainText("Not fed from the logical model yet.");
  await expect(page.getByTestId("item-cube-fed-from-concept")).toHaveCount(0);

  // Dim Date.day_of_week fed from Product.product_name (another concept, only for the test): one more row, any status
  const before = (await liveCubeMappings()).length;
  await openAttribute(page, "Dim Date", "day_of_week");
  const { attribute } = await ids();
  await page.getByTestId("select-add-logical-attribute").selectOption(attribute("Product", "product_name").id);
  await expect.poll(async () => (await liveCubeMappings()).length).toBe(before + 1);
  await openEntity(page, "Dim Date");
  await expect.poll(() => conceptRows(page)).toEqual([{ text: "Product 1 attribute", title: "From Product (mappings in any status)" }]);
  await undoButton(page).click();
  await expect.poll(async () => (await liveCubeMappings()).length).toBe(before);
  await expect(page.getByTestId("item-cube-fed-from-concept")).toHaveCount(0);
  // the star's own feeds are untouched
  expect((await liveCubeMappings()).some((m) => m.id === cubeMappingId("cust.segment_code") && m.attribute_id === attrId("cust.segment_code"))).toBe(true);
});
