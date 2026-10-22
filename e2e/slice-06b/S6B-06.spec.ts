// S6B-06 (slice 6b, item 7; Łukasz's step 1 answer 5), the project part (step 2): a project that does not exist opens
// the workspace home with the toast “That project no longer exists.”, for every arrival: a typed address, and Back or
// Forward onto it. A card removed from its canvas: Back onto its place shows the canvas without a selection and “That
// card is no longer on this canvas.”, and Forward still works. A deleted canvas: Back onto it opens the project's first
// canvas with the “moved” notice, as the app handles any visit (the background refresh after the traversal finds it gone).

import { expect, test } from "./fixtures";
import {
  backButton,
  canvasIn,
  canvasUrl,
  card,
  clickCard,
  expectAt,
  expectSelected,
  expectToast,
  forwardButton,
  openCanvas,
  openCanvasMenu,
  projectPath,
  SEED_IDS,
  signInAs,
  WHOLE_CO,
  WS_HOME,
} from "./helpers";

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

test("S6B-06: Back onto a card that left the canvas: no selection and a toast; Forward still works", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await clickCard(page, "customers");
  await expectSelected(page, "table");
  await clickCard(page, "Customer");
  await expectSelected(page, "entity:Customer");
  // the right-click selects customers again (a place), then it leaves the canvas
  await card(page, "customers").locator(".c-head .c-l2").click({ button: "right" });
  await page.getByTestId("menu-toolbox").getByTestId("toolbox-item").filter({ hasText: "Remove from this canvas" }).click();
  await expect(card(page, "customers")).toHaveCount(0);

  await backButton(page).click();
  await expectSelected(page, "entity:Customer");
  await backButton(page).click();
  await expectToast(page, "That card is no longer on this canvas.");
  await expectSelected(page, "none");
  await forwardButton(page).click();
  await expectSelected(page, "entity:Customer");
});

test("S6B-06: Back onto a deleted canvas opens the project's first canvas with the notice; Forward still works", async ({ page }) => {
  const om = SEED_IDS.projOrderManagement, lines = SEED_IDS.canvasOrderLines, both = SEED_IDS.canvasCustomerOrders;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasIn(om, lines));
  await page.getByTestId("tab-canvas-name").filter({ hasText: "Customer & orders" }).click();
  await expectAt(page, canvasIn(om, both));
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  const menu = await openCanvasMenu(page, "Order lines & products");
  await menu.getByTestId("menu-item-delete-canvas").click();
  await expectToast(page, "Deleted the canvas Order lines & products. The model and its mappings are untouched.");

  await backButton(page).click();
  await expectToast(page, "This canvas is no longer in Order management. Opened Customer & orders.");
  await expectAt(page, canvasIn(om, both));
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(forwardButton(page)).toBeEnabled();
  await forwardButton(page).click();
  await expectAt(page, canvasIn(om, both));
});

