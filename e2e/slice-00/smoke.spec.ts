import { expect, test } from "@playwright/test";

// Scaffold and sign-in check. Replaced by the S0-xx acceptance tests in step 6.
test("without a session the app sends you to the development sign-in, and back after sign-out", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByTestId("banner-dev-sign-in")).toContainText("Development sign-in");

  await page.getByTestId("button-dev-user").filter({ hasText: "Łukasz" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("text-signed-in-as")).toHaveText("Signed in as Łukasz");

  await page.getByTestId("button-sign-out").click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("a cookie with an unknown user does not count as a session", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "infomapper_dev_session", value: "01a0f9e9-ffff-7000-8000-000000000000", url: baseURL! }]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
});
