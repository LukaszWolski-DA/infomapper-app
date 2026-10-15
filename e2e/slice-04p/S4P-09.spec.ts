// S4P-09 (slice 4p, item 8): an error inside the canvas shows its message in the canvas's place while the panels and the
// top bar keep working, and “Reload” brings the canvas back; an unknown route shows the not-found page. The error is
// thrown through the test hook `window.__imCanvasThrow()` (e2e dev server only).

import { expect, test } from "../slice-04a/fixtures";
import { openCanvas, openRequirementsTab, requirementRow, signInAs } from "../slice-04a/helpers";

test("S4P-09: an error in the canvas shows “Something went wrong on this canvas.” with Reload; the panels and the top bar still work; Reload recovers; an unknown route shows the not-found page", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await page.evaluate(() => (window as unknown as { __imCanvasThrow: () => void }).__imCanvasThrow());

  const message = page.getByTestId("panel-canvas-error");
  await expect(message).toBeVisible();
  await expect(message).toContainText("Something went wrong on this canvas.");
  await expect(message).toContainText("The panels still work. Reload the canvas to try again; your saved work is not affected.");
  await expect(page.getByTestId("area-canvas")).toHaveCount(0);

  // the panels still work: the left panel's Requirements tab and a requirement's panel in the inspector
  await openRequirementsTab(page);
  await requirementRow(page, "REQ-101").click();
  await expect(page.getByTestId("input-req-key")).toHaveValue("REQ-101");
  // the top bar and the tabs too: the canvas tabs are there and the Model tab is back
  await expect(page.getByTestId("tab-model")).toBeVisible();
  await page.getByTestId("tab-model").click();
  await expect(page.getByTestId("tab-model")).toHaveAttribute("aria-selected", "true");

  // Reload draws the canvas again
  await page.getByTestId("button-canvas-reload").click();
  await expect(message).toHaveCount(0);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();

  // an unknown route: the not-found page, status 404, with a way back
  const unknown = await page.goto("/no-such-page");
  expect(unknown?.status()).toBe(404);
  await expect(page.getByTestId("page-not-found")).toContainText("This page does not exist.");
  await expect(page.getByTestId("page-not-found")).toContainText("The link may be out of date, or what it pointed to was deleted.");
  await page.getByTestId("link-start-page").click();
  await expect(page).not.toHaveURL(/no-such-page/);
});
