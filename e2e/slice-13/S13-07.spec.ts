import { expect, test } from "./fixtures";
import { changeRequirementAsAnna, conflictLine, expectToast, notSaved, openCanvas, openRequirement, otherValue, recordToasts, requirementByKey, signInAs, STALE } from "./helpers";

// S13-07 (items 6–8, 11, R6): the requirement panel no longer goes back after a refusal. Anna changes REQ-103's owner;
// this page saves the name and at once the owner: the name is refused as stale ("Not saved", its own value did not
// change), the owner's save is cut (the conflict line, Anna changed it); a refused key (a validation refusal) is kept.

test("S13-07: the requirement panel keeps the typed text in every field after a refusal", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await openRequirement(page, "REQ-103");
  const panel = page.getByTestId("panel-requirement");
  const before = await requirementByKey("REQ-103");

  await changeRequirementAsAnna("REQ-103", "owner_name", "Anna Nowak");
  await panel.getByTestId("input-req-name").fill("Unique e-mail per customer");
  await panel.getByTestId("input-req-name").press("Tab");
  await panel.getByTestId("input-req-owner").fill("Łukasz");
  await panel.getByTestId("input-req-owner").press("Enter");
  await expectToast(page, STALE);
  await expect(panel.getByTestId("input-req-name")).toHaveValue("Unique e-mail per customer");
  await expect(panel.getByTestId("input-req-owner")).toHaveValue("Łukasz");
  await expect(notSaved(panel)).toHaveCount(1);
  await expect(conflictLine(panel)).toHaveCount(1);
  await expect(otherValue(panel)).toHaveText("Anna Nowak");
  expect(await requirementByKey("REQ-103")).toMatchObject({ name: before.name, owner_name: "Anna Nowak" });

  // a validation refusal keeps the key
  await panel.getByTestId("input-req-key").fill("REQ-101");
  await panel.getByTestId("input-req-key").press("Enter");
  await expectToast(page, "REQ-101 is already used by another requirement.");
  await expect(panel.getByTestId("input-req-key")).toHaveValue("REQ-101");
  expect((await requirementByKey("REQ-103")).key).toBe("REQ-103");
});
