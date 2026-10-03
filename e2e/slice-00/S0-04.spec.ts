import { expect, test } from "./fixtures";
import { createFromSwitcher, expectToast, signInAs } from "./helpers";

test("S0-04: Łukasz creates project Finance and canvas Invoices; Finance has First canvas and Invoices as tiles and tabs", async ({ page }) => {
  await signInAs(page, "Łukasz");

  // create project "Finance" and open it
  await createFromSwitcher(page, "switcher-project", "input-new-project", "Finance");
  await expectToast(page, "Created the project Finance.");
  await expect(page.getByTestId("page-project-home")).toContainText("Finance");
  await expect(page.getByTestId("switcher-project")).toHaveText("Finance");
  await expect(page.getByTestId("tile-canvas-name")).toHaveText(["First canvas"]);

  // create canvas "Invoices": New canvas, then name it in its tab
  await page.getByTestId("tile-new-canvas").click();
  await expectToast(page, "Created the canvas Untitled canvas 2.");
  await expect(page.getByTestId("area-canvas")).toBeVisible();
  const nameField = page.getByTestId("input-canvas-name");
  await expect(nameField).toBeFocused();
  await nameField.fill("Invoices");
  await nameField.press("Enter");
  await expectToast(page, "Renamed the canvas to Invoices.");

  // it is a tab, and the canvas page shows the empty placeholder
  await expect(page.getByTestId("tab-canvas-name")).toHaveText(["First canvas", "Invoices"]);
  await expect(page.getByTestId("tab-canvas").filter({ hasText: "Invoices" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("area-canvas")).toContainText("The canvas is empty");
  await expect(page.getByTestId("area-canvas")).toContainText("The canvas arrives in slice 1.");
  await expect(page.getByTestId("panel-left")).toBeVisible();
  await expect(page.getByTestId("panel-inspector")).toBeVisible();
  await expect(page).not.toHaveURL(/rename=1/);

  // and a tile on the project home
  await page.getByTestId("tab-home").click();
  await expect(page.getByTestId("tile-canvas-name")).toHaveText(["First canvas", "Invoices"]);
  await expect(page.getByTestId("page-project-home")).toContainText("2 canvases");
});

test("S0-04: a canvas can be renamed from its tile menu and by double-clicking its tab", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await createFromSwitcher(page, "switcher-project", "input-new-project", "Rename check");
  await expect(page.getByTestId("tile-canvas-name")).toHaveText(["First canvas"]);

  await page.getByTestId("tile-canvas").hover();
  await page.getByTestId("tile-canvas").getByTestId("button-canvas-menu").click();
  await page.getByTestId("menu-item-rename").click();
  await page.getByTestId("input-canvas-name").fill("Overview");
  await page.getByTestId("input-canvas-name").press("Enter");
  await expectToast(page, "Renamed the canvas to Overview.");
  await expect(page.getByTestId("tab-canvas-name")).toHaveText(["Overview"]);

  await page.getByTestId("tab-canvas").dblclick();
  await page.getByTestId("input-canvas-name").fill("Big picture");
  await page.getByTestId("input-canvas-name").press("Enter");
  await expectToast(page, "Renamed the canvas to Big picture.");
  await expect(page.getByTestId("tab-canvas-name")).toHaveText(["Big picture"]);
  await expect(page.getByTestId("nav-breadcrumbs")).toContainText("Big picture");
});
