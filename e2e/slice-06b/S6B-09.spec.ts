// S6B-09 (slice 6b, item 13): the row with Back and Forward. From 800 to 2,560 px nothing in the row reaches past it,
// the buttons are always there, before the breadcrumbs, and the row stays 32 px high (view-state chips on too, so the
// fold has to count the buttons). A button's state change adds 0 canvas and 0 miniature commits.

import { expect, test } from "./fixtures";
import { backButton, breadcrumbsRow, canvasUrl, counters, forwardButton, openCanvas, signInAs, WHOLE_CO } from "./helpers";

test("S6B-09: the buttons never fold, nothing in the row is cut off, and their state change commits nothing", async ({ page }) => {
  test.setTimeout(90_000);
  await signInAs(page, "Łukasz");
  await page.setViewportSize({ width: 2560, height: 900 });
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await page.getByTestId("button-focus").click();
  await page.locator('[data-testid="switch-layer"] [data-layer="mappings"]').click();
  await page.getByTestId("button-tool-hand").click();

  for (const width of [2560, 2100, 1536, 1300, 1100, 1000, 800]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(200);
    const s = await breadcrumbsRow(page).evaluate((row) => {
      const r = row.getBoundingClientRect();
      const box = (sel: string) => row.querySelector(sel)!.getBoundingClientRect();
      const items = [...row.querySelectorAll<HTMLElement>("[data-testid='button-back'],[data-testid='button-forward'],[data-testid='breadcrumb'],[data-testid^='chip-'],[data-testid='button-view-show-all']")].filter((e) => e.offsetParent !== null && !e.closest("[aria-hidden]"));
      return {
        height: Math.round(r.height),
        outside: items.filter((e) => e.getBoundingClientRect().right > r.right + 0.5).map((e) => e.dataset.testid),
        backRight: box("[data-testid='button-forward']").right,
        crumbLeft: box("ol").left,
        backWidth: Math.round(box("[data-testid='button-back']").width),
      };
    });
    expect(s.height, `${width}`).toBe(32);
    expect(s.outside, `${width}`).toEqual([]);
    expect(s.backWidth, `${width}`).toBe(24);
    expect(s.backRight, `${width}: buttons before the breadcrumbs`).toBeLessThanOrEqual(s.crumbLeft);
  }

  // a button's state change: an entry pushed without a URL enables Back, with no commit
  await page.setViewportSize({ width: 1536, height: 900 });
  await page.waitForTimeout(500);
  const before = await counters(page);
  const wasEnabled = await backButton(page).isEnabled();
  await page.evaluate(() => window.history.pushState(null, ""));
  await expect(backButton(page)).toBeEnabled();
  await page.evaluate(() => window.history.back());
  await expect(forwardButton(page)).toBeEnabled();
  await page.waitForTimeout(500);
  const after = await counters(page);
  expect({ canvas: after.canvas - before.canvas, miniature: after.miniature - before.miniature, wasEnabled }).toEqual({ canvas: 0, miniature: 0, wasEnabled });
});
