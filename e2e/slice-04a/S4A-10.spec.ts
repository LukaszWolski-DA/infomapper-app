import { expect, test } from "./fixtures";
import { expectToast, ids, loadModel, loadRequirementLinks, loadRequirements, openCanvas, openRequirement, requirementByKey, row, signInAs, tracesOf } from "./helpers";

test("S4A-10: deleting REQ-102: its toast, REQ-103 becomes top level, its links go, the model is untouched; one undo brings all of it back. Deleting the attribute email deletes its links and its undo brings them back", async ({ page }) => {
  const { attribute } = await ids();
  const email = attribute("Customer", "email");
  const before = await loadModel();
  const links102 = await tracesOf("REQ-102");
  const r102 = await requirementByKey("REQ-102");
  expect((await requirementByKey("REQ-103")).parent_id).toBe(r102.id);

  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await openRequirement(page, "REQ-102");
  await page.getByTestId("button-delete-requirement").click();
  await expectToast(page, "Deleted REQ-102. The model elements it traced to are untouched.");
  await expect.poll(async () => (await loadRequirements()).some((r) => r.key === "REQ-102")).toBe(false);
  expect((await requirementByKey("REQ-103")).parent_id).toBeNull();
  expect((await loadRequirementLinks()).some((k) => k.requirement_id === r102.id)).toBe(false);
  const after = await loadModel();
  expect([after.attributes.length, after.mappings.length, after.mappingInputs.length]).toEqual([before.attributes.length, before.mappings.length, before.mappingInputs.length]);

  await page.getByTestId("button-undo").click();
  await expect.poll(async () => (await loadRequirements()).some((r) => r.key === "REQ-102")).toBe(true);
  expect((await requirementByKey("REQ-103")).parent_id).toBe(r102.id);
  expect(await tracesOf("REQ-102")).toEqual(links102);

  // deleting email (it has mappings: a second click confirms) takes its three requirement links
  const emailLinks = async () => (await loadRequirementLinks()).filter((k) => k.attribute_id === email.id).length;
  expect(await emailLinks()).toBe(3);
  await row(page, "Customer", email.id).click();
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await page.getByTestId("button-delete-attribute").click();
  await page.getByTestId("button-delete-attribute").click();
  await expect.poll(emailLinks).toBe(0);
  await expect(page.getByTestId("button-undo")).toBeEnabled();
  await page.getByTestId("button-undo").click();
  await expect.poll(emailLinks).toBe(3);
});
