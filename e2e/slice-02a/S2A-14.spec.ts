// S2A-14 on “Performance test” (seed:large), with slice 1b's measuring method (e2e/slice-01b/measure.ts). Step 3 has
// the group drag: a lasso at about 20 % selects at least 20 cards, the view zooms in to 50 %, then one of them is
// dragged by its header in circles
// for 6 s while every frame is recorded, against the bar of 45 fps on average. Step 5 adds the lasso's marks and pan
// and zoom with the grid. The normal run checks the steps briefly without judging the speed:
//
//   MEASURE=1 npx playwright test e2e/slice-02a/S2A-14.spec.ts
//
// Results go to test-results/S2A-14.json.

import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB } from "../config";
import { MEASURE, MEASURE_USE, openLarge, saveResults, startRecording, stopRecording } from "../slice-01b/measure";
import { expect, test, type Page } from "./fixtures";
import { box, loadItems, signInAs } from "./helpers";

if (MEASURE) test.use(MEASURE_USE);

test("S2A-14: on “Performance test”, dragging a group of at least 20 cards at 50 % runs at 45 fps or better on average", async ({ page, browser }) => {
  test.setTimeout(MEASURE ? 300_000 : 180_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  // a lasso at 0.5 / 1.2⁵ ≈ 20 % catches enough cards fully; five “Zoom in” clicks (× 1.2) then give 50 %, and the
  // selection stays
  await openLarge(page, { x: 0, y: 0, zoom: 0.5 / 1.2 ** 5 });
  const pane = await box(page.locator(".react-flow__pane"));
  const lassoView = async () => {
    await page.mouse.move(pane.x + 4, pane.y + 4);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(pane.x + 4 + ((pane.width - 250) * i) / 10, pane.y + 4 + ((pane.height - 8) * i) / 10);
    await page.mouse.up();
  };
  await lassoView();
  // a smaller window catches fewer: pan right by most of the view and add a second lasso (Shift)
  if ((await page.getByTestId("mark-selected").count()) < 24) {
    await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
    await page.mouse.wheel(pane.width - 300, 0);
    await page.waitForTimeout(300);
    await page.keyboard.down("Shift");
    await lassoView();
    await page.keyboard.up("Shift");
  }
  for (let i = 0; i < 5; i++) await page.getByTestId("button-zoom-in").click();
  await expect(page.getByTestId("value-zoom")).toHaveText("50%");
  const marks = page.getByTestId("mark-selected");
  await expect.poll(() => marks.count()).toBeGreaterThanOrEqual(20);
  const selected = await marks.count();

  // drag one of them by its header, in circles, and record every frame
  const lead = (await marks.first().getAttribute("data-card"))!;
  await openViewOf(page, lead);
  const head = await box(page.locator(`.react-flow__node[data-id="${lead}"] .c-head`));
  const at = { x: head.x + 30, y: head.y + head.height / 2 };
  const before = (await loadItems(LARGE_IDS.workspace, LARGE_IDS.canvas)).find((i) => i.id === lead)!;
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await startRecording(page);
  const t0 = Date.now();
  let a = 0;
  while (Date.now() - t0 < (MEASURE ? 6000 : 1500)) {
    a += 0.05;
    await page.mouse.move(at.x + 80 * Math.sin(a) + 80, at.y + 60 * Math.cos(a) - 60);
  }
  const drag = await stopRecording(page);
  await page.mouse.up();

  // the whole group was saved in one change
  await expect.poll(async () => (await loadItems(LARGE_IDS.workspace, LARGE_IDS.canvas)).find((i) => i.id === lead)!.version).toBeGreaterThan(before.version);

  const results = { measured: MEASURE, browser: browser.version(), viewport: page.viewportSize(), zoom: 0.5, selected, "group drag": drag };
  saveResults("S2A-14", results);
  await test.info().attach("S2A-14 results", { body: JSON.stringify(results, null, 2), contentType: "application/json" });
  if (MEASURE) expect.soft(drag.avgFps, "group drag, average fps (bar 45)").toBeGreaterThanOrEqual(45);
});

/** Pans (no zoom change, no reload) so the card's header is near the top left of the view. */
async function openViewOf(page: Page, cardId: string) {
  const pane = await box(page.locator(".react-flow__pane"));
  for (let i = 0; i < 20; i++) {
    const head = await box(page.locator(`.react-flow__node[data-id="${cardId}"] .c-head`));
    const dx = head.x - (pane.x + 120), dy = head.y - (pane.y + 80);
    if (Math.abs(dx) < 40 && Math.abs(dy) < 40) return;
    await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
    await page.mouse.wheel(Math.max(-400, Math.min(400, dx)), Math.max(-400, Math.min(400, dy)));
    await page.waitForTimeout(150);
  }
}
