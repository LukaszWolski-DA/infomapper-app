import { expect, test } from "./fixtures";
import { card, cubeStore, liveEntityNamed, openCanvas, recordToasts, signInAs, STAR_VIEW, starUrl, toasts } from "./helpers";

// Slice 15a step 5 (Łukasz, after step 4): a source column mapped to a fact's or a dimension's attribute is refused in the
// domain, with B-6's toast, so that no such mapping exists before 15c. Through the attribute panel's "Add a source column",
// the path a person has today; the dimmed targets and the rest of B-6 come with 15c.

const B6 = "Source columns map to the logical model. Map the column to a logical attribute, then that attribute to the fact or dimension.";

test("S15 mapping target: a source column onto a fact's attribute is refused with B-6's toast; nothing is written", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, starUrl(), STAR_VIEW);
  const fact = (await liveEntityNamed("Fact Sales"))!;
  const mappingsBefore = (await cubeStore().model.load(fact.workspace_id)).mappings.length;

  await card(page, "Fact Sales").locator("[data-row]").filter({ hasText: "quantity" }).click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  const select = page.getByTestId("select-add-source-column");
  const value = await select.evaluate((el: HTMLSelectElement) => [...el.options].find((o) => o.value)?.value ?? "");
  expect(value, "a column to pick").not.toBe("");
  await select.selectOption(value);

  await expect.poll(() => toasts(page)).toContain(B6);
  const model = await cubeStore().model.load(fact.workspace_id);
  expect(model.mappings.length).toBe(mappingsBefore);
  const quantity = model.attributes.find((a) => a.entity_id === fact.id && a.name === "quantity")!;
  expect(model.mappings.filter((m) => m.attribute_id === quantity.id)).toEqual([]);
});
