// S6B-06 (slice 6b, item 7; Łukasz's step 1 answer 5), the project part (step 2): a project that does not exist opens
// the workspace home with the toast “That project no longer exists.”, for every arrival: a typed address, and Back or
// Forward onto it. The gone card and the deleted canvas come with step 3.

import { expect, test } from "./fixtures";
import { backButton, expectAt, expectToast, forwardButton, projectPath, signInAs, WS_HOME } from "./helpers";

const GONE = "01900000-0000-7000-8000-0000000000ff";

test("S6B-06: a project that no longer exists opens the workspace home with a toast, also through Back and Forward", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(projectPath(GONE));
  await expectAt(page, WS_HOME);
  await expectToast(page, "That project no longer exists.");
  await expect(page.getByTestId("page-workspace-home")).toBeVisible();

  // from a real project home, Back and Forward still work around it
  await page.getByTestId("tile-project").filter({ hasText: "Customer 360" }).click();
  await expectAt(page, projectPath());
  await backButton(page).click();
  await expectAt(page, WS_HOME);
  await forwardButton(page).click();
  await expectAt(page, projectPath());
});
