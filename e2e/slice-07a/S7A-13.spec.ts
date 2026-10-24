import { expect, test } from "./fixtures";
import { openWizard } from "./helpers";

test("S7A-13: no sample links on any channel (P10); the standard's description and template.csv are there", async ({ page }) => {
  const dialog = await openWizard(page);
  for (const channel of ["file", "query", "ddl"] as const) {
    await page.getByTestId(`radio-channel-${channel}`).check();
    await expect(dialog.getByText(/sample/i)).toHaveCount(0);
  }
  await page.getByTestId("details-standard").locator("summary").click();
  await expect(page.getByTestId("text-template")).toBeVisible();
  await expect(page.getByTestId("button-copy-template")).toBeVisible();
});
