// Slice 6b's smoke in Firefox and WebKit (Łukasz's step 1 answer 2; on demand: `BROWSERS=1 npx playwright test
// e2e/slice-06b/S6B-browsers.spec.ts`, also in Chromium). The Navigation API is Baseline since January 2026, so the
// buttons are there; page places and one selection place walk back and forward.

import { expect, test } from "./fixtures";
import { backButton, canvasUrl, clickCard, expectAt, expectSelected, forwardButton, openCanvas, projectPath, signInAs, WHOLE_CO } from "./helpers";

test("S6B browsers: page places and a selection place go back and forward", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await expect(backButton(page)).toBeVisible();

  // a selection place
  await clickCard(page, "Customer");
  await expectSelected(page, "entity:Customer");
  await clickCard(page, "Sales Order");
  await expectSelected(page, "entity:Sales Order");
  await backButton(page).click();
  await expectSelected(page, "entity:Customer");

  // a page place
  await page.getByTestId("breadcrumb").filter({ hasText: "Customer 360" }).click();
  await expectAt(page, projectPath());
  await backButton(page).click();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expectSelected(page, "entity:Customer");
  await forwardButton(page).click();
  await expectAt(page, projectPath());
});
