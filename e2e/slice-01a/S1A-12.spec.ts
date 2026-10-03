import { expect, test, type Page } from "./fixtures";
import { canvasUrl, card, expectToast, loadModel, newSession, openCanvas, RETAIL, SEED_IDS } from "./helpers";

async function openMapping(page: Page, attributeId: string) {
  await openCanvas(page, canvasUrl());
  await card(page, "Customer").locator(`[data-row="${attributeId}"]`).click();
  await page.getByTestId("list-attribute-mappings").getByRole("button").first().click();
  return page.getByTestId("panel-mapping");
}

test("S1A-12: four-eyes on: the person who changed a mapping's rule cannot approve it; another modeler can", async ({ browser }) => {
  const model = await loadModel();
  const customer = model.entities.find((e) => e.name === "Customer")!;
  const firstName = model.attributes.find((a) => a.entity_id === customer.id && a.name === "first_name")!;
  const mapping = model.mappings.find((m) => m.attribute_id === firstName.id)!;

  // Łukasz (owner) turns four-eyes on and changes the mapping's rule
  const lukasz = await newSession(browser, "Łukasz");
  await lukasz.page.goto(`/w/${RETAIL}?tab=settings`);
  await lukasz.page.getByTestId("checkbox-four-eyes").check();
  await expectToast(lukasz.page, "Four-eyes approval is on.");

  let panel = await openMapping(lukasz.page, firstName.id);
  await panel.getByTestId("seg-mapping-kind").getByRole("button", { name: "Transformation" }).click();
  await panel.getByTestId("input-mapping-rule").fill("UPPER(fname)");
  await panel.getByTestId("input-mapping-rule").blur();
  await expectToast(lukasz.page, "This mapping was approved; your change sends it back to review.");
  await expect(panel.getByTestId("seg-mapping-status").locator('[aria-pressed="true"]')).toHaveText("In review");

  // ...so he cannot approve it: the panel says so, and the server refuses
  await expect(panel.getByTestId("note-four-eyes")).toHaveText("Four-eyes is on: someone else has to approve your change.");
  await panel.getByTestId("seg-mapping-status").getByRole("button", { name: "Approved" }).click();
  await expectToast(lukasz.page, "Four-eyes is on: someone else has to approve your change.");
  expect((await loadModel()).mappings.find((m) => m.id === mapping.id)!.status).toBe("review");

  // Anna (another modeler) can
  const anna = await newSession(browser, "Anna Nowak");
  panel = await openMapping(anna.page, firstName.id);
  await expect(panel.getByTestId("note-four-eyes")).toHaveCount(0);
  await panel.getByTestId("seg-mapping-status").getByRole("button", { name: "Approved" }).click();
  await expect(panel.getByTestId("seg-mapping-status").locator('[aria-pressed="true"]')).toHaveText("Approved");
  expect((await loadModel()).mappings.find((m) => m.id === mapping.id)).toMatchObject({ status: "approved", approved_by: SEED_IDS.userAnna });
});
