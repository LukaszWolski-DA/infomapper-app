import { expect, test } from "./fixtures";
import { canvasUrl, openCanvas, SEED_IDS, signInAs } from "./helpers";

test("S1A-06: the notation switch changes relationship ends between crow's foot and UML on every canvas", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  const rels = await page.getByTestId("line-relationship").count();
  expect(rels).toBeGreaterThan(0);
  const notation = page.getByTestId("switch-notation");
  await expect(notation.locator('[data-notation="ie"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("ends-ie")).toHaveCount(rels);
  await expect(page.getByTestId("ends-uml")).toHaveCount(0);

  await notation.locator('[data-notation="uml"]').click();
  await expect(page.getByTestId("ends-uml")).toHaveCount(rels);
  await expect(page.getByTestId("ends-ie")).toHaveCount(0);
  await expect(page.getByTestId("ends-uml").first()).toContainText(/\d|\*/);

  // another canvas, in another project, uses the same setting (D-22)
  await openCanvas(page, canvasUrl(SEED_IDS.canvasOrderLines, SEED_IDS.projOrderManagement));
  await expect(page.getByTestId("switch-notation").locator('[data-notation="uml"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("ends-uml")).toHaveCount(await page.getByTestId("line-relationship").count());
  await expect(page.getByTestId("ends-ie")).toHaveCount(0);

  await page.getByTestId("switch-notation").locator('[data-notation="ie"]').click();
  await openCanvas(page, canvasUrl());
  await expect(page.getByTestId("ends-ie")).toHaveCount(rels);
});
