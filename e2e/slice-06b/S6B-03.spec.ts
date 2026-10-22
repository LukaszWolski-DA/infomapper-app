// S6B-03 (slice 6b, items 4–5, section 6): a selection place makes no route change and no server request (no RSC fetch,
// no server action), recording it or going back and forward over it; and Back to a selection costs the canvas the same
// commits at most as clicking the same item (development counters, from a quiet page).

import { expect, test, type Page } from "./fixtures";
import { backButton, canvasUrl, clickCard, counters, expectSelected, forwardButton, openCanvas, signInAs, WHOLE_CO } from "./helpers";

/** Waits until the commit counters have not moved for 800 ms. */
async function quiet(page: Page) {
  let last = JSON.stringify(await counters(page));
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(800);
    const now = JSON.stringify(await counters(page));
    if (now === last) return;
    last = now;
  }
}

async function commitsOf(page: Page, act: () => Promise<void>) {
  await quiet(page);
  const before = await counters(page);
  await act();
  await quiet(page);
  const after = await counters(page);
  return { canvas: after.canvas - before.canvas, miniature: after.miniature - before.miniature };
}

test("S6B-03: selection places route nothing and fetch nothing; Back to a selection costs what a click costs", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  const url = page.url();
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("_rsc=") || r.headers()["next-action"] || r.headers()["rsc"]) requests.push(r.url());
  });

  await clickCard(page, "Customer");
  await expectSelected(page, "entity:Customer");
  // Customer → Sales Order by a click
  const byClick = await commitsOf(page, async () => {
    await clickCard(page, "Sales Order");
    await expectSelected(page, "entity:Sales Order");
  });
  await clickCard(page, "Customer");
  await expectSelected(page, "entity:Customer");
  // Customer → Sales Order by Back
  const byBack = await commitsOf(page, async () => {
    await backButton(page).click();
    await expectSelected(page, "entity:Sales Order");
  });
  await forwardButton(page).click();
  await expectSelected(page, "entity:Customer");

  // at most what the click costs (measured: Back 1 canvas commit, the click 3 with its pointer events)
  expect(byBack.canvas).toBeLessThanOrEqual(byClick.canvas);
  expect(byBack.miniature).toBeLessThanOrEqual(byClick.miniature);
  expect(page.url()).toBe(url);
  expect(requests).toEqual([]);
});
