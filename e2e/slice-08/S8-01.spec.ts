import { expect, test } from "./fixtures";
import { SEED_IDS, signInAs } from "./helpers";

test("S8-01: without a session every page leads to the start page with both paths; the test users' list signs in as before", async ({ page }) => {
  for (const path of ["/", `/w/${SEED_IDS.wsRetailDwh}`]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
  }
  await expect(page.getByTestId("panel-sign-in")).toContainText("Sign in");
  await expect(page.getByTestId("panel-create-organization")).toContainText("Create an organization");
  await expect(page.getByTestId("banner-dev-sign-in")).toContainText("Development sign-in");
  await expect(page.getByTestId("list-dev-users").getByTestId("button-dev-user")).toHaveCount(5);

  await signInAs(page, "Łukasz");
  await expect(page).toHaveURL(new RegExp(`/w/${SEED_IDS.wsRetailDwh}$`));
  // the development list unlocks every organization the test user reaches: no lock in the switcher
  await page.getByTestId("switcher-organization").click();
  await expect(page.getByTestId("menu-item-organization")).toHaveCount(2);
  await expect(page.getByTestId("icon-locked")).toHaveCount(0);
});
