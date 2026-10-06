// S2A-14 on “Performance test” (seed:large), with slice 1b's measuring method (e2e/slice-01b/measure.ts). Step 3 has
// the group drag: a lasso at about 20 % selects at least 20 cards, the view zooms in to 50 %, then one of them is
// dragged by its header in circles
// for 6 s while every frame is recorded, against the bar of 45 fps on average; then the same card alone, for
// comparison. Step 4 adds pan and zoom with the grid (second test): grid None, Dots and Lines in turn, three runs each,
// at the overview and at 100 %, against slice 1b's medians minus 5 % (overview 55.2 → 52.4 fps, 100 % 51.7 → 49.1 fps);
// None is the reference for the grid's own cost. Step 5 adds the lasso's marks. The normal run checks the steps briefly
// without judging the speed:
//
//   MEASURE=1 npx playwright test e2e/slice-02a/S2A-14.spec.ts
//
// Results go to test-results/S2A-14.json and test-results/S2A-14-grid.json.

import { seedLargeData } from "../../src/data/local/dev-data";
import { generate } from "../../src/data/local/large-generator";
import { SEED_IDS } from "../../src/data/local/seed";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { setCanvasLook } from "../../src/domain/commands/canvas";
import { uuidv7 } from "../../src/domain/ids";
import type { CanvasGrid } from "../../src/domain/types";
import { E2E_DB } from "../config";
import { median, MEASURE, MEASURE_USE, openLarge, panZoom, saveResults, startRecording, stopRecording, type FrameStats } from "../slice-01b/measure";
import { expect, test, type Page } from "./fixtures";
import { box, loadItems, signInAs, store } from "./helpers";

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

/** Slice 1b's pan-and-zoom medians minus 5 % (PRD S2A-14). */
const GRID_BARS = { overview: 52.4, "100%": 49.1 } as const;
const GRIDS: CanvasGrid[] = ["none", "dots", "lines"];

/** Sets the grid of the large canvas through the domain, as Łukasz (its owner). */
async function setGrid(grid: CanvasGrid) {
  const s = store();
  const canvas = await s.canvases.get(LARGE_IDS.workspace, LARGE_IDS.canvas);
  if (canvas!.look.grid === grid) return;
  const workspace = (await s.workspaces.get(LARGE_IDS.workspace))!;
  const access = { workspace, member: await s.workspaces.getMember(workspace.id, SEED_IDS.userLukasz) };
  const ctx = { actorId: SEED_IDS.userLukasz, now: new Date().toISOString(), newId: () => uuidv7() };
  const result = setCanvasLook(ctx, access, { canvas }, { canvasId: LARGE_IDS.canvas, expectedVersion: canvas!.version, grid });
  if (!result.ok) throw new Error(result.error.message);
  const applied = await s.apply(result.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
}

test("S2A-14: pan and zoom with grid Dots and with grid Lines are each no more than 5 % below slice 1b's medians (overview 55.2 fps, 100 % 51.7 fps)", async ({ page, browser }) => {
  test.setTimeout(MEASURE ? 900_000 : 240_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  const src57 = generate().cards.find((c) => c.id === "src:57")!;
  const size = page.viewportSize()!;
  const views = [
    ["overview", undefined],
    ["100%", { x: size.width / 2 - src57.x, y: 300 - src57.y, zoom: 1 }],
  ] as const;
  const runs: Record<CanvasGrid, Record<"overview" | "100%", FrameStats[]>> = {
    none: { overview: [], "100%": [] },
    dots: { overview: [], "100%": [] },
    lines: { overview: [], "100%": [] },
  };
  // the grids take turns in every run, so a slow spell of the laptop hits all three alike
  for (let r = 0; r < (MEASURE ? 3 : 1); r++) {
    for (const grid of GRIDS) {
      await setGrid(grid);
      for (const [name, view] of views) {
        await openLarge(page, view);
        await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-grid", grid);
        if (grid !== "none") await expect.poll(() => page.getByTestId("canvas-grid").evaluate((e) => (e as HTMLElement).style.backgroundSize)).not.toBe("");
        await startRecording(page);
        await panZoom(page, MEASURE ? 10_000 : 2_000);
        runs[grid][name].push(await stopRecording(page));
      }
    }
  }
  await setGrid("dots");
  const medianFps = Object.fromEntries(
    GRIDS.map((g) => [g, { overview: median(runs[g].overview.map((x) => x.avgFps)), "100%": median(runs[g]["100%"].map((x) => x.avgFps)) }]),
  ) as Record<CanvasGrid, Record<"overview" | "100%", number>>;
  const relativeToNone = Object.fromEntries(
    (["dots", "lines"] as const).map((g) => [
      g,
      Object.fromEntries((["overview", "100%"] as const).map((v) => [v, `${(((medianFps[g][v] - medianFps.none[v]) / medianFps.none[v]) * 100).toFixed(1)} %`])),
    ]),
  );

  const build = process.env.MEASURE_BUILD === "production" ? "production (measurement build)" : "dev server";
  const results = { measured: MEASURE, build, browser: browser.version(), viewport: page.viewportSize(), bars: GRID_BARS, medianFps, relativeToNone, runs };
  saveResults("S2A-14-grid", results);
  await test.info().attach("S2A-14 grid results", { body: JSON.stringify(results, null, 2), contentType: "application/json" });
  if (MEASURE) {
    for (const g of ["dots", "lines"] as const) {
      expect.soft(medianFps[g].overview, `grid ${g}: pan and zoom at the overview, median fps of 3 runs (bar 52.4)`).toBeGreaterThanOrEqual(GRID_BARS.overview);
      expect.soft(medianFps[g]["100%"], `grid ${g}: pan and zoom at 100 %, median fps of 3 runs (bar 49.1)`).toBeGreaterThanOrEqual(GRID_BARS["100%"]);
    }
  }
});
