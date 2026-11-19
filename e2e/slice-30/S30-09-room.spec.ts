// S30-09 (slice 30, Q6's table): the top bar's room as the prototype: the Hand, Entity, Note and Frame labels show from
// 2,101 px, the brand from 1,601 px, the user's role and the badge's full label from 1,501 px (the short label below).
// S6A-10 checks again that nothing is cut off from 800 to 2,560 px with the pair in the bar.
import { expect, test } from "./fixtures";
import { badge, canvasUrl, FULL, openCanvas, signInAs } from "./helpers";

const label = (page: import("@playwright/test").Page, tool: string) => page.getByTestId(`button-tool-${tool}`).locator("span").filter({ hasText: new RegExp(`^${tool}$`, "i") });

test("S30-09 (room): tool labels from 2,101 px, the brand from 1,601 px, the role and the badge's label from 1,501 px", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.setViewportSize({ width: 2101, height: 900 });
  await openCanvas(page, canvasUrl(), FULL);
  for (const tool of ["hand", "entity", "note", "frame"]) await expect(label(page, tool)).toBeVisible();
  await page.setViewportSize({ width: 2100, height: 900 });
  for (const tool of ["hand", "entity", "note", "frame"]) await expect(label(page, tool)).toBeHidden();

  const brand = page.getByTestId("bar-top").getByText("InfoMapper", { exact: true });
  await page.setViewportSize({ width: 1601, height: 900 });
  await expect(brand).toBeVisible();
  await page.setViewportSize({ width: 1600, height: 900 });
  await expect(brand).toBeHidden();

  const role = page.getByTestId("indicator-user-role");
  await page.setViewportSize({ width: 1501, height: 900 });
  await expect(role).toBeVisible();
  await expect(badge(page).locator("span").first()).toBeVisible();
  await page.setViewportSize({ width: 1500, height: 900 });
  await expect(role).toBeHidden();
  await expect(badge(page).locator("span").first()).toBeHidden();
  await expect(badge(page).locator("span").nth(1)).toBeVisible();
  await expect(badge(page)).toBeVisible();
});
