// S33-03 (criterion 3), its local part: "Change password…" and "Password reset link" are online only (the Postgres
// smoke set, `e2e/slice-29/S33-smoke-people.spec.ts`, has the rest). Locally neither is shown, and a reset link's page
// shows the refused message.
import { expect, test } from "./fixtures";
import { openPeople, SEED_IDS, signInAs } from "./helpers";

test("S33-03: locally no Change password in the person's menu, no Password reset link, and /reset/… refuses", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openPeople(page, SEED_IDS.wsRetailDwh);
  await expect(page.getByTestId("button-reset-link")).toHaveCount(0);
  await page.getByTestId("indicator-user").click();
  await expect(page.getByTestId("button-sign-out")).toBeVisible();
  await expect(page.getByTestId("button-change-password")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.goto(`/reset/${"A".repeat(43)}`);
  await expect(page.getByTestId("title-link")).toHaveText("Set a new password");
  await expect(page.getByTestId("text-link-gone")).toContainText("This password reset link has expired, was already used or was revoked. Nothing was changed.");
  await expect(page.getByTestId("form-reset")).toHaveCount(0);
});
