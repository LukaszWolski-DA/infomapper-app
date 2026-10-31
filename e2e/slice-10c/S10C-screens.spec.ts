// Slice 10c, step 4: screenshots of the copies in the interface (runs only with SCREENS=<folder>, into
// docs/prd/slice-10c-screens/<folder>/). Customer.customer_id pasted into Order Line and Product (test data):
// the original's panel, a copy's panel linked and with its original deleted, the second click of a delete, D-47's
// preview and the paste item in a card's menu. Light mode.
//
//   SCREENS=step-4 npx playwright test e2e/slice-10c/S10C-screens.spec.ts

import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "./fixtures";
import { attributeOf, canvasUrl, clickCard, copyRow, deleteAs, expectAttributeShown, headOf, openCanvas, pasteAs, rowNamed, signInAs } from "./helpers";

const OUT = path.resolve("docs", "prd", "slice-10c-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));

test.use({ viewport: { width: 1536, height: 864 } });
test.skip(!process.env.SCREENS, "screenshots only with SCREENS=<folder>");

async function panelShot(page: Page, name: string) {
  await page.mouse.move(2, 2);
  await page.waitForTimeout(400);
  await page.getByTestId("panel-inspector").screenshot({ path: path.join(OUT, `${name}.png`) });
}

test("S10C screens: copies in the panels, the delete's second click, D-47's row and the paste item", async ({ page }) => {
  test.setTimeout(180_000);
  fs.mkdirSync(OUT, { recursive: true });
  const original = await attributeOf("Customer", "customer_id");
  await pasteAs("Order Line", original);
  await pasteAs("Product", original);

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  // the original's panel with its copies
  await rowNamed(page, "Customer", "customer_id").click();
  await expectAttributeShown(page, "Customer.customer_id");
  await expect(page.getByTestId("item-attribute-copy")).toHaveCount(2);
  await page.getByTestId("fold-attribute-copies").scrollIntoViewIfNeeded();
  await panelShot(page, "1-original-with-copies");

  // the second click on the original
  await page.getByTestId("button-delete-attribute").click();
  await expect(page.getByTestId("button-delete-attribute")).toHaveAttribute("data-armed", "true");
  await page.getByTestId("button-delete-attribute").scrollIntoViewIfNeeded();
  await page.getByTestId("panel-inspector").screenshot({ path: path.join(OUT, "4-delete-second-click.png") });

  // a copy's panel, linked
  await rowNamed(page, "Order Line", "customer_id").click();
  await expectAttributeShown(page, "Order Line.customer_id");
  await page.getByTestId("panel-inspector").evaluate((p) => p.querySelector("[data-testid='note-copied-from']")?.scrollIntoView({ block: "start" }));
  await panelShot(page, "2-copy-linked");

  // the paste item in a card header's menu
  await copyRow(page, "Customer", "customer_id");
  const b = (await headOf(page, "Sales Order").boundingBox())!;
  await page.mouse.click(b.x + 30, b.y + b.height / 2, { button: "right" });
  await expect(page.getByTestId("menu-toolbox")).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "6-paste-item-in-card-menu.png") });
  await page.keyboard.press("Escape");

  // D-47's preview with the copies row
  await clickCard(page, "Customer");
  await page.getByTestId("button-delete-entity").click();
  const dialog = page.getByTestId("dialog-delete-entity");
  await expect(dialog.getByTestId("table-entity-impact").locator("tbody tr").filter({ hasText: /copies/ })).toBeVisible();
  await page.waitForTimeout(300);
  await dialog.screenshot({ path: path.join(OUT, "5-entity-preview-copies-row.png") });
  await page.keyboard.press("Escape");

  // a copy's panel with its original deleted
  await deleteAs(original.id);
  await page.reload();
  await rowNamed(page, "Order Line", "customer_id").click();
  await expectAttributeShown(page, "Order Line.customer_id");
  await expect(page.getByTestId("note-copied-from")).toContainText("which was deleted");
  await page.getByTestId("panel-inspector").evaluate((p) => p.querySelector("[data-testid='note-copied-from']")?.scrollIntoView({ block: "start" }));
  await panelShot(page, "3-copy-original-deleted");
});
