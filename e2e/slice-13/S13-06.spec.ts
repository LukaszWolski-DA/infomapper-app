import { expect, test } from "./fixtures";
import { changeSettingsElsewhere, conflictLine, expectToast, hydrated, keepMine, otherValue, recordToasts, RETAIL, signInAs, STALE, store, undoButton } from "./helpers";

// S13-06 (items 7, 11, F10): the workspace settings form keeps the typed description after a conflict, with the line;
// "Keep mine" saves it, without an undo step (settings are not undo steps). A description cleared meanwhile reads
// "Cleared meanwhile.".

const description = async () => (await store().workspaces.get(RETAIL))!.description;

test("S13-06: the settings' description: the conflict line; Keep mine saves without an undo step; Cleared meanwhile", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await page.goto(`/w/${RETAIL}?tab=settings`);
  await hydrated(page);
  const form = page.getByTestId("form-workspace-settings");
  const field = form.getByTestId("input-workspace-description");
  await expect(undoButton(page)).toBeDisabled();

  await changeSettingsElsewhere({ description: "The other session's description." });
  await field.fill("Mine: the DWH for retail.");
  await field.blur();
  await expectToast(page, STALE);
  await expect(otherValue(form)).toHaveText("The other session's description.");
  await expect(field).toHaveValue("Mine: the DWH for retail.");
  await keepMine(form).click();
  await expect.poll(description).toBe("Mine: the DWH for retail.");
  await expect(conflictLine(form)).toHaveCount(0);
  await expect(undoButton(page)).toBeDisabled();

  // cleared meanwhile
  await changeSettingsElsewhere({ description: "" });
  await field.fill("Mine again.");
  await field.blur();
  await expect(otherValue(form)).toHaveText("Cleared meanwhile.");
  await expect(field).toHaveValue("Mine again.");
});
