import { expect, test, type Page } from "@playwright/test";
import { createFromSwitcher, expectToast, SEED_IDS, signInAs } from "./helpers";

const ws = SEED_IDS.wsRetailDwh;
const c360 = `/w/${ws}/p/${SEED_IDS.projCustomer360}`;
const orders = `/w/${ws}/p/${SEED_IDS.projOrderManagement}`;

async function openCanvasMenu(page: Page, canvasName: string) {
  const tile = page.getByTestId("tile-canvas").filter({ hasText: canvasName });
  await tile.hover();
  await tile.getByTestId("button-canvas-menu").click();
}
const inProject = (page: Page, project: string) =>
  page.getByTestId("menu-item-in-project").filter({ hasText: project });

test("S0-05: a canvas can be added to a second project and removed from one; a shared canvas survives removal (D-28)", async ({ page }) => {
  await signInAs(page, "Łukasz");

  // add "Order lines & products" to Customer 360 from the project home
  await page.goto(c360);
  await expect(page.getByTestId("tile-canvas-name")).toHaveText(["Customer & orders"]);
  await page.getByTestId("tile-add-canvas").click();
  await expect(page.getByTestId("menu-add-canvas")).toContainText("The canvas stays in its other projects too; it is the same canvas, not a copy.");
  await page.getByTestId("menu-item-add-canvas").filter({ hasText: "Order lines & products" }).click();
  await expectToast(page, "Order lines & products is now also in Customer 360.");
  await expect(page.getByTestId("tile-canvas-name")).toHaveText(["Customer & orders", "Order lines & products"]);
  await expect(page.getByTestId("tile-canvas").filter({ hasText: "Order lines & products" })).toContainText("Also in Order management");

  // remove the shared "Customer & orders" from Order management with the "In projects" checkboxes
  await page.goto(orders);
  await openCanvasMenu(page, "Customer & orders");
  await expect(inProject(page, "Customer 360")).toHaveAttribute("aria-checked", "true");
  await expect(inProject(page, "Order management")).toHaveAttribute("aria-checked", "true");
  await inProject(page, "Order management").click();
  await expectToast(page, "Took Customer & orders out of Order management. It is still in Customer 360.");
  // its tile (and with it the menu) is gone from Order management
  await expect(page.getByTestId("tile-canvas-name")).toHaveText(["Order lines & products"]);

  // the canvas itself survives: it is still in Customer 360 and opens there
  await page.goto(c360);
  await expect(page.getByTestId("tile-canvas-name")).toHaveText(["Customer & orders", "Order lines & products"]);
  await page.getByTestId("tile-canvas").filter({ hasText: "Customer & orders" }).getByRole("link").click();
  await expect(page.getByTestId("area-canvas")).toBeVisible();

  // a canvas keeps at least one project, and a project at least one canvas
  await page.goto(orders);
  await openCanvasMenu(page, "Order lines & products");
  await inProject(page, "Order management").click();
  await expectToast(page, "This project would have no canvas left.");
  await page.keyboard.press("Escape");

  // put things back for the other tests
  await openCanvasMenu(page, "Order lines & products");
  await inProject(page, "Customer 360").click();
  await expectToast(page, "Took Order lines & products out of Customer 360. It is still in Order management.");
  await page.keyboard.press("Escape");
  await page.goto(c360);
  await openCanvasMenu(page, "Customer & orders");
  await inProject(page, "Order management").click();
  await expectToast(page, "Customer & orders is now also in Order management.");
});

test("S0-05: a canvas that is only in one project cannot be taken out of it", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await createFromSwitcher(page, "switcher-project", "input-new-project", "Solo");
  await expect(page.getByTestId("tile-canvas-name")).toHaveText(["First canvas"]);
  await page.getByTestId("tile-new-canvas").click();
  await expectToast(page, "Created the canvas Untitled canvas 2.");
  await page.getByTestId("input-canvas-name").press("Escape");
  await page.getByTestId("tab-home").click();
  await expect(page.getByTestId("tile-canvas-name")).toHaveText(["First canvas", "Untitled canvas 2"]);

  await openCanvasMenu(page, "First canvas");
  await inProject(page, "Solo").click();
  await expectToast(page, "A canvas belongs to at least one project.");
  await expect(inProject(page, "Solo")).toHaveAttribute("aria-checked", "true");
});
