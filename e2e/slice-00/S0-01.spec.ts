import { expect, test } from "./fixtures";
import { SEED_IDS, signInAs, signOutViaMenu } from "./helpers";

test("S0-01: without a session every page redirects to /sign-in; Łukasz lands on Retail Co – DWH; sign-out returns to /sign-in", async ({ page }) => {
  for (const path of ["/", `/w/${SEED_IDS.wsRetailDwh}`, `/w/${SEED_IDS.wsRetailDwh}/p/${SEED_IDS.projCustomer360}`]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
  }
  await expect(page.getByTestId("banner-dev-sign-in")).toContainText("Development sign-in");

  await signInAs(page, "Łukasz");
  await expect(page).toHaveURL(new RegExp(`/w/${SEED_IDS.wsRetailDwh}$`));
  await expect(page.getByTestId("page-workspace-home")).toContainText("Retail Co – DWH");

  await signOutViaMenu(page);
  await page.goto(`/w/${SEED_IDS.wsRetailDwh}`);
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("S0-01: after sign-in the last used workspace opens (AD-07)", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(`/w/${SEED_IDS.wsSales}`);
  await signOutViaMenu(page);
  await signInAs(page, "Łukasz");
  await expect(page).toHaveURL(new RegExp(`/w/${SEED_IDS.wsSales}$`));
});

test("S0-01: a cookie with an unknown user is not a session", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "infomapper_dev_session", value: "01a0f9e9-ffff-7000-8000-000000000000", url: baseURL! }]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
});
