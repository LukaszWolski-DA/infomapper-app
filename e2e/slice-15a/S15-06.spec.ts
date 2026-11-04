import { expect, test } from "./fixtures";
import { openCanvas, signInAs, STAR_VIEW, starUrl } from "./helpers";

// S15-06 (IC-02, B-1): the Model tab lists the logical entities only; the Cube tab lists facts, then dimensions, each
// by concept, with a fact's grain and a dimension's SCD type on the right, and New fact and New dimension at its top.

test("S15-06: the Model tab lists logical entities only; the Cube tab facts then dimensions by concept", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, starUrl(), STAR_VIEW);
  await expect(page.locator('[role="tablist"]').filter({ has: page.getByTestId("tab-model") }).getByRole("tab")).toHaveText(["Model", "Sources", "Requirements", "Cube"]);
  await expect(page.getByTestId("tab-cube")).toHaveAttribute("title", "InfoCube: facts and dimensions");

  const tree = page.getByTestId("tree");
  await page.getByTestId("tab-model").click();
  const names = await tree.getByTestId("tree-item").allInnerTexts();
  expect(names.some((n) => /Fact|Dim /.test(n))).toBe(false);
  expect(names.some((n) => n.startsWith("Customer"))).toBe(true);

  await page.getByTestId("tab-cube").click();
  await expect(page.getByTestId("button-new-fact")).toHaveText("New fact");
  await expect(page.getByTestId("button-new-dimension")).toHaveText("New dimension");
  const sections = tree.getByTestId("tree-tab-section");
  await expect(sections.getByTestId("tree-section-head")).toHaveText([/^Facts\s*2$/, /^Dimensions\s*3$/]);
  const facts = sections.nth(0), dims = sections.nth(1);
  await expect(facts.getByTestId("tree-concept-head")).toHaveText([/^Sales\s*2$/]);
  await expect(facts.getByTestId("tree-item")).toHaveText([/Fact Orders\s*grain set/, /Fact Sales\s*grain set/]);
  await expect(dims.getByTestId("tree-concept-head")).toHaveText([/^Customer\s*1$/, /^Product\s*1$/, /^Reference data\s*1$/]);
  await expect(dims.getByTestId("tree-item")).toHaveText([/Dim Customer\s*SCD 2/, /Dim Product\s*SCD 1/, /Dim Date\s*SCD 0/]);
  // the items are on this canvas (a filled dot), as in the Model tab
  await expect(facts.getByTestId("tree-item").first()).toHaveAttribute("data-presence", "here");

  // the search looks in this tab's level only
  await page.getByTestId("input-tree-search").fill("customer");
  // a fact's attribute matches too, as in the Model tab
  await expect(tree.getByTestId("tree-item")).toHaveText([/^Fact Orders\s*attribute customer_key/, /^Fact Sales\s*attribute customer_key/, /^Dim Customer\s*SCD 2$/]);
  await page.getByTestId("tab-model").click();
  await expect(tree.getByTestId("tree-item").first()).toContainText("Customer");
  expect((await tree.getByTestId("tree-item").allInnerTexts()).some((n) => n.includes("Dim Customer"))).toBe(false);
});
