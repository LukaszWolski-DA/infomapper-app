import { expect, test } from "./fixtures";
import { changeRoleAs, grantLicence, hydrated, infocubeBox, infocubeCheck, recordToasts, RETAIL, SEED_IDS, settingsUrl, signInAs, switchRefusal, toasts, workspaceRow } from "./helpers";

// S15-03 (C-7, O2): the InfoCube box is always in the settings. Without the licence its check box is disabled with
// "InfoMate has no InfoCube licence." and a direct call is refused; with it an owner and an admin turn InfoCube on,
// while a modeler sees the check box disabled and a direct call is refused.
test.use({ star: false });

const NO_LICENCE = "InfoMate has no InfoCube licence.";

test("S15-03: without the licence the box is disabled with its line and a direct call is refused; with it an owner and an admin switch it, a modeler cannot", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await page.goto(settingsUrl());
  await hydrated(page);
  await expect(infocubeBox(page)).toBeVisible();
  await expect(infocubeCheck(page)).toBeDisabled();
  await expect(infocubeCheck(page)).not.toBeChecked();
  await expect(page.getByTestId("text-infocube-licence")).toHaveText(NO_LICENCE);
  expect(await switchRefusal(SEED_IDS.userLukasz, true)).toBe(NO_LICENCE);

  // the licence, as scripts/licence.ts grants it: the owner turns InfoCube on
  await grantLicence();
  await page.reload();
  await hydrated(page);
  await expect(page.getByTestId("text-infocube-licence")).toHaveText("Licensed for InfoMate.");
  await expect(infocubeCheck(page)).toBeEnabled();
  await infocubeCheck(page).check();
  await expect.poll(() => toasts(page)).toContain("InfoCube is on: facts and dimensions are in the Cube tab.");
  await expect.poll(async () => (await workspaceRow()).infocube).toBe(true);

  // a modeler: the check box disabled, a direct call refused with the settings' rights
  await signInAs(page, "Anna Nowak");
  await page.goto(settingsUrl());
  await hydrated(page);
  await expect(infocubeCheck(page)).toBeDisabled();
  await expect(infocubeCheck(page)).toBeChecked();
  expect(await switchRefusal(SEED_IDS.userAnna, false)).toBe("As a modeler you cannot change the workspace settings.");

  // an admin turns it off (nothing dimensional yet) and on again
  await changeRoleAs(SEED_IDS.userLukasz, RETAIL, SEED_IDS.userAnna, "admin");
  await page.reload();
  await hydrated(page);
  await expect(infocubeCheck(page)).toBeEnabled();
  await infocubeCheck(page).uncheck();
  await expect.poll(() => toasts(page)).toContain("InfoCube is off.");
  await expect.poll(async () => (await workspaceRow()).infocube).toBe(false);
  await infocubeCheck(page).check();
  await expect.poll(async () => (await workspaceRow()).infocube).toBe(true);
});
