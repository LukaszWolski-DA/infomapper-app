// S2A-14 on “Performance test” (seed:large), with slice 1b's measuring method (e2e/slice-01b/measure.ts):
// - group drag: a lasso at about 20 % selects at least 20 cards, the view zooms in to 50 %, then one of them is dragged
//   by its header in circles for 6 s while every frame is recorded, against the bar of 45 fps on average (partly met,
//   known-limitations.md); then the same card alone, for comparison;
// - the selection marks after a lasso around the whole view at the overview (every card fully inside it; the tallest
//   stick out even at the lowest zoom), median of 20, against 100 ms. Since slice 2b a frame fully inside is caught
//   instead of its cards (D-17), so the marks counted are the caught frames and the caught cards outside them.
// Pan and zoom are compared with `main` by S2A-14-pan-zoom.spec.ts and scripts/measure-ab.ts. The normal run checks
// the steps briefly without judging the speed:
//
//   MEASURE=1 npx playwright test e2e/slice-02a/S2A-14.spec.ts
//
// Results go to test-results/S2A-14.json and test-results/S2A-14-lasso.json.

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
  // With Shift held: since slice 2b the canvas has frames, and a plain drag inside a frame moves it (D-14), while
  // Shift + drag draws a lasso there too (D-15); with nothing selected yet it is the same as a plain lasso.
  const lassoView = async () => {
    await page.keyboard.down("Shift");
    await page.mouse.move(pane.x + 4, pane.y + 4);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(pane.x + 4 + ((pane.width - 250) * i) / 10, pane.y + 4 + ((pane.height - 8) * i) / 10);
    await page.mouse.up();
    await page.keyboard.up("Shift");
  };
  await lassoView();
  // a smaller window catches fewer: pan right by most of the view and add a second lasso
  if ((await page.getByTestId("mark-selected").count()) < 24) {
    await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
    await page.mouse.wheel(pane.width - 300, 0);
    await page.waitForTimeout(300);
    await lassoView();
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

  // for comparison: the same card dragged alone (no selection)
  await page.keyboard.press("Escape");
  await expect(marks).toHaveCount(0);
  const head1 = await box(page.locator(`.react-flow__node[data-id="${lead}"] .c-head`));
  const at1 = { x: head1.x + 30, y: head1.y + head1.height / 2 };
  await page.mouse.move(at1.x, at1.y);
  await page.mouse.down();
  await startRecording(page);
  const t1 = Date.now();
  let b = 0;
  while (Date.now() - t1 < (MEASURE ? 6000 : 1500)) {
    b += 0.05;
    await page.mouse.move(at1.x + 80 * Math.sin(b) + 80, at1.y + 60 * Math.cos(b) - 60);
  }
  const single = await stopRecording(page);
  await page.mouse.up();

  const build = process.env.MEASURE_BUILD === "production" ? "production (measurement build)" : "dev server";
  const results = { measured: MEASURE, build, browser: browser.version(), viewport: page.viewportSize(), zoom: 0.5, selected, "group drag": drag, "single-card drag": single };
  saveResults("S2A-14", results);
  await test.info().attach("S2A-14 results", { body: JSON.stringify(results, null, 2), contentType: "application/json" });
  if (MEASURE) expect.soft(drag.avgFps, "group drag, average fps (bar 45)").toBeGreaterThanOrEqual(45);
});

test("S2A-14: on “Performance test”, the selection marks appear within 100 ms after releasing a lasso around every card at the overview (median of 20)", async ({ page, browser }) => {
  test.setTimeout(MEASURE ? 300_000 : 180_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  await openLarge(page); // the overview: everything fitted
  const pane = await box(page.locator(".react-flow__pane"));
  // the cards fully in the view: at the spike's 1536 × 864 (MEASURE=1) every card; in a normal run's smaller window not all
  const total = await page.locator(".react-flow__node").count();
  const frameOf = Object.fromEntries((await loadItems(LARGE_IDS.workspace, LARGE_IDS.canvas)).map((i) => [i.id, i.frame_id]));
  // even at the overview (10 %, the lowest zoom) the tallest cards of “Performance test” stick out of the view, so the
  // lasso around the whole view selects what is fully inside it: whole frames, and the cards not in one of those
  // (slice 2b, D-17); how many is recorded
  const { frames, cards } = await page.evaluate(
    ({ p, frameOf }) => {
      const within = (e: Element) => {
        const r = e.getBoundingClientRect();
        return r.left >= p.x + 3 && r.top >= p.y + 3 && r.right <= p.x + p.width - 3 && r.bottom <= p.y + p.height - 3;
      };
      const caught = new Set([...document.querySelectorAll<HTMLElement>("[data-frame]")].filter(within).map((e) => e.dataset.frame!));
      const cards = [...document.querySelectorAll<HTMLElement>(".react-flow__node")].filter((e) => within(e) && !caught.has(frameOf[e.dataset.id!] ?? ""));
      return { frames: caught.size, cards: cards.length };
    },
    { p: pane, frameOf },
  );
  const marks = '[data-testid="mark-selected"], [data-testid="mark-selected-frame"]';
  // the time from the release to the first frame after the marks are in the page (as C-10: to the next frame)
  await page.evaluate(() => {
    const w = window as unknown as { __up: number };
    window.addEventListener("pointerup", (e) => (w.__up = e.timeStamp), { capture: true });
  });
  const times: number[] = [];
  for (let i = 0; i < (MEASURE ? 20 : 3); i++) {
    await page.keyboard.press("Escape");
    await expect(page.locator(marks)).toHaveCount(0);
    await page.mouse.move(pane.x + 3, pane.y + 3);
    await page.mouse.down();
    for (let k = 1; k <= 8; k++) await page.mouse.move(pane.x + 3 + ((pane.width - 6) * k) / 8, pane.y + 3 + ((pane.height - 6) * k) / 8);
    const waiting = page.evaluate(
      ({ n, marks }) =>
        new Promise<number>((done) => {
          const tick = () => {
            if (document.querySelectorAll(marks).length >= n) {
              requestAnimationFrame((t) => done(t - (window as unknown as { __up: number }).__up));
            } else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      { n: frames + cards, marks },
    );
    await page.mouse.up();
    times.push(+(await waiting).toFixed(1));
  }
  await expect(page.getByTestId("mark-selected-frame")).toHaveCount(frames);
  await expect(page.getByTestId("mark-selected")).toHaveCount(cards);
  const sorted = [...times].sort((a, b) => a - b);
  const medianMs = sorted[Math.floor(sorted.length / 2)]!;
  const build = process.env.MEASURE_BUILD === "production" ? "production (measurement build)" : "dev server";
  const results = { measured: MEASURE, build, browser: browser.version(), viewport: page.viewportSize(), frames, cards, total, medianMs, maxMs: sorted[sorted.length - 1], times };
  saveResults("S2A-14-lasso", results);
  await test.info().attach("S2A-14 lasso results", { body: JSON.stringify(results, null, 2), contentType: "application/json" });
  if (MEASURE) expect.soft(medianMs, "marks after the lasso, median ms of 20 (bar 100)").toBeLessThanOrEqual(100);
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
