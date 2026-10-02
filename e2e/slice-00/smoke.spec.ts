import { expect, test } from "@playwright/test";

// Scaffold check (step 1). Replaced by the S0-xx acceptance tests in step 6.
test("the app starts and serves the home page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("page-home")).toContainText("InfoMapper");
});
