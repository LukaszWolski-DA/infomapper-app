import { expect, test } from "./fixtures";
import { SEED_IDS, signInAs } from "./helpers";

test("S0-03: the user indicator shows the role, coloured by what it allows, and its menu explains the role", async ({ page }) => {
  await signInAs(page, "Łukasz");
  const indicator = page.getByTestId("indicator-user");
  const roleText = page.getByTestId("menu-user-role");

  await expect(page.getByTestId("indicator-user-role")).toHaveText("Owner");
  await expect(indicator).toHaveAttribute("data-standing", "full");
  await indicator.click();
  await expect(page.getByTestId("menu-user")).toContainText("lukasz@infomate.pl");
  await expect(roleText).toContainText("In Retail Co – DWH you are Owner.");
  await expect(roleText).toContainText("You can do everything here, including deleting or transferring the workspace.");
  await page.keyboard.press("Escape");

  await page.goto(`/w/${SEED_IDS.wsSales}`);
  await expect(page.getByTestId("indicator-user-role")).toHaveText("Reviewer · guest");
  await expect(indicator).toHaveAttribute("data-standing", "review");
  await indicator.click();
  await expect(roleText).toContainText("In Sales analytics you are Reviewer, a guest from InfoMate.");
  await expect(roleText).toContainText("You can approve mappings and requirements and add notes, but not edit the model.");
  await page.keyboard.press("Escape");

  await page.goto(`/w/${SEED_IDS.wsBankX}`);
  await expect(page.getByTestId("indicator-user-role")).toHaveText("Archived");
  await expect(indicator).toHaveAttribute("data-standing", "none");
  await indicator.click();
  await expect(roleText).toContainText("In Bank X – Risk DWH you are Owner.");
  await expect(roleText).toContainText("The workspace is archived, so everything is read-only.");
});

test("S0-03: a reader is shown in red", async ({ page }) => {
  await signInAs(page, "Kasia Zielińska");
  await expect(page.getByTestId("indicator-user-role")).toHaveText("Reader · guest");
  await expect(page.getByTestId("indicator-user")).toHaveAttribute("data-standing", "none");
});
