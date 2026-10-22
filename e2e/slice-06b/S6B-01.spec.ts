// S6B-01 (slice 6b, items 1–4, 9–11; Łukasz's step 1 answers 3, 7): page places walk the browser's history. The
// workspace home's tab is not a place: it replaces the entry. Through four places (the workspace home on its People
// tab, a project home, its canvas, another project's home), Back three times (the button, Alt+←, the browser's back)
// and Forward twice (the button, Alt+→) land on the expected place each time.

import { expect, test } from "./fixtures";
import { altArrow, backButton, expectAt, forwardButton, projectPath, SEED_IDS, signInAs, WS_HOME } from "./helpers";

test("S6B-01: Back and Forward walk the page places, with the buttons, Alt+←/→ and the browser's back", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await expectAt(page, WS_HOME);

  // the People tab replaces the entry
  await page.getByTestId("tab-people").click();
  await expectAt(page, `${WS_HOME}?tab=people`);
  await page.getByTestId("switcher-project").click();
  await page.getByTestId("menu-item-project").filter({ hasText: "Customer 360" }).click();
  await expectAt(page, projectPath());
  await page.getByTestId("tile-canvas").filter({ hasText: "Customer & orders" }).click();
  await expectAt(page, new RegExp(`/c/${SEED_IDS.canvasCustomerOrders}$`));
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("switcher-project").click();
  await page.getByTestId("menu-item-project").filter({ hasText: "Order management" }).click();
  await expectAt(page, projectPath(SEED_IDS.projOrderManagement));
  await expect(forwardButton(page)).toBeDisabled();

  // Back: the button, Alt+←, the browser's back
  await backButton(page).click();
  await expectAt(page, new RegExp(`/c/${SEED_IDS.canvasCustomerOrders}$`));
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await altArrow(page, "ArrowLeft");
  await expectAt(page, projectPath());
  await page.goBack();
  await expectAt(page, `${WS_HOME}?tab=people`);
  await expect(page.getByTestId("tab-people")).toHaveAttribute("aria-selected", "true");

  // Forward: the button, Alt+→
  await forwardButton(page).click();
  await expectAt(page, projectPath());
  await altArrow(page, "ArrowRight");
  await expectAt(page, new RegExp(`/c/${SEED_IDS.canvasCustomerOrders}$`));
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(forwardButton(page)).toBeEnabled();

  // the tab was not a place: from the workspace home, Back leaves it (to the sign-in page before it)
  await page.goBack();
  await page.goBack();
  await expectAt(page, `${WS_HOME}?tab=people`);
  await backButton(page).click();
  await expectAt(page, "/sign-in");
});
