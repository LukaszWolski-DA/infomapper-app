// S6B-08, the edit in progress (slice 6b, Q5; Łukasz's step 1 answer 8): a details panel field with the focus and an
// unsaved edit, then the browser's back: the field is blurred when the traversal starts (the Navigation API's `navigate`
// event), so the edit is saved; the browser's own blur at that moment would not reach the save.

import { expect, test } from "./fixtures";
import { canvasUrl, card, expectAt, loadModel, openCanvas, projectPath, signInAs, WHOLE_CO } from "./helpers";

test("S6B-08: an edit in a focused field is saved when Back leaves the page", async ({ page }) => {
  await signInAs(page, "Łukasz");
  // the view set first (openCanvas passes through another page), then project home → canvas by links
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await page.getByTestId("breadcrumb").filter({ hasText: "Customer 360" }).click();
  await expectAt(page, projectPath());
  await page.getByTestId("tile-canvas").filter({ hasText: "Customer & orders" }).click();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await card(page, "Customer").locator(".c-head .c-l2").click();
  const name = page.getByTestId("input-entity-name");
  await expect(name).toHaveValue("Customer");
  await name.click();
  await name.fill("Customer master");
  await expect(name).toBeFocused();

  await page.goBack();
  await expectAt(page, projectPath());
  await expect.poll(async () => (await loadModel()).entities.some((e) => e.name === "Customer master")).toBe(true);
});
