import { expect, test } from "./fixtures";
import { card, cubeStore, liveEntityNamed, openCanvas, signInAs, STAR_VIEW, starUrl } from "./helpers";

// Slice 15a step 5 (Łukasz, after step 4): a source column mapped to a fact's or a dimension's attribute is refused in the
// domain, with B-6's toast, so that no such mapping exists. Since 15c step 5 a dimensional attribute's panel shows "Comes
// from the logical model" in place of InfoMapper's source section, so "Add a source column" is no longer offered there;
// B-6's toast on the canvas's path, a column dropped onto a dimensional row, is S15-09 (e2e/slice-15c).

test("S15 mapping target: a fact's attribute offers no source column; it comes from the logical model; nothing is written", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, starUrl(), STAR_VIEW);
  const fact = (await liveEntityNamed("Fact Sales"))!;

  await card(page, "Fact Sales").locator("[data-row]").filter({ hasText: "quantity" }).click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await expect(page.getByTestId("fold-cube-comes-from")).toBeVisible();
  await expect(page.getByTestId("select-add-source-column")).toHaveCount(0);

  const model = await cubeStore().model.load(fact.workspace_id);
  const facts = new Set(model.attributes.filter((a) => a.entity_id === fact.id).map((a) => a.id));
  expect(model.mappings.filter((m) => facts.has(m.attribute_id))).toEqual([]);
});
