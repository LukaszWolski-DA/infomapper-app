// S2A-14, pan and zoom (changed in step 5, Łukasz, 7 October 2026): no regression against `main`. This spec runs in
// both trees, `main` and this branch, in turns in the same sitting, driven by `npx tsx scripts/measure-ab.ts` (dev
// server and the measurement-only production build); the script compares the medians (within 5 %, at the overview and
// at 100 %). It may only use what `main` has too. On this branch it measures with the grids in turns (AB_GRIDS,
// default “dots,lines,none”); on `main` (AB_SIDE=main) the canvas has no grid. The spike's pan-and-zoom steps, as in
// S1A-14 and S1B-10. A normal e2e run checks the steps briefly without judging the speed.
//
// Results go to test-results/S2A-14-pan-zoom.json.

import { seedLargeData } from "../../src/data/local/dev-data";
import { generate } from "../../src/data/local/large-generator";
import { E2E_DB } from "../config";
import { signInAs } from "../slice-01b/helpers";
import { median, MEASURE, MEASURE_USE, openLarge, panZoom, saveResults, startRecording, stopRecording, type FrameStats } from "../slice-01b/measure";
import { expect, test } from "../slice-01b/fixtures";

if (MEASURE) test.use(MEASURE_USE);

const SIDE = process.env.AB_SIDE === "main" ? "main" : "branch";
const GRIDS = SIDE === "main" ? ["main"] : (process.env.AB_GRIDS ?? "dots,lines,none").split(",");
const RUNS = Number(process.env.AB_RUNS ?? 3);

/** This branch only: the large canvas's grid, set through the domain as Łukasz (its owner). */
async function setGrid(grid: string) {
  const [{ createLocalDataStore }, { setCanvasLook }, { LARGE_IDS }, { SEED_IDS }, { uuidv7 }] = await Promise.all([
    import("../../src/data/local/store"),
    import("../../src/domain/commands/canvas"),
    import("../../src/data/local/seed-large"),
    import("../../src/data/local/seed"),
    import("../../src/domain/ids"),
  ]);
  const s = createLocalDataStore(E2E_DB);
  const canvas = (await s.canvases.get(LARGE_IDS.workspace, LARGE_IDS.canvas))!;
  if (canvas.look.grid === grid) return;
  const workspace = (await s.workspaces.get(LARGE_IDS.workspace))!;
  const access = { workspace, member: await s.workspaces.getMember(workspace.id, SEED_IDS.userLukasz) };
  const ctx = { actorId: SEED_IDS.userLukasz, now: new Date().toISOString(), newId: () => uuidv7() };
  const result = setCanvasLook(ctx, access, { canvas }, { canvasId: canvas.id, expectedVersion: canvas.version, grid: grid as "dots" });
  if (!result.ok) throw new Error(result.error.message);
  const applied = await s.apply(result.writeSet);
  if (!applied.ok) throw new Error(applied.error.message);
}

test("S2A-14: pan and zoom on “Performance test” do not regress against main (one side of the comparison)", async ({ page, browser }) => {
  test.setTimeout(MEASURE ? 1_200_000 : 240_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  const src57 = generate().cards.find((c) => c.id === "src:57")!;
  const size = page.viewportSize()!;
  const views = [
    ["overview", undefined],
    ["100%", { x: size.width / 2 - src57.x, y: 300 - src57.y, zoom: 1 }],
  ] as const;
  const runs: Record<string, Record<string, FrameStats[]>> = Object.fromEntries(GRIDS.map((g) => [g, { overview: [], "100%": [] }]));
  // the grids take turns in every run, so a slow spell of the laptop hits all of them alike
  for (let r = 0; r < (MEASURE ? RUNS : 1); r++) {
    for (const grid of GRIDS) {
      if (SIDE === "branch") await setGrid(grid);
      for (const [name, view] of views) {
        await openLarge(page, view);
        if (SIDE === "branch") await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-grid", grid);
        await startRecording(page);
        await panZoom(page, MEASURE ? 10_000 : 2_000);
        runs[grid]![name]!.push(await stopRecording(page));
      }
    }
  }
  if (SIDE === "branch") await setGrid("dots");
  const fps = Object.fromEntries(
    GRIDS.map((g) => [g, { overview: runs[g]!.overview!.map((x) => x.avgFps), "100%": runs[g]!["100%"]!.map((x) => x.avgFps) }]),
  );
  const medianFps = Object.fromEntries(GRIDS.map((g) => [g, { overview: median(fps[g]!.overview), "100%": median(fps[g]!["100%"]) }]));
  const build = process.env.MEASURE_BUILD === "production" ? "production" : "dev";
  const results = { measured: MEASURE, side: SIDE, build, browser: browser.version(), viewport: page.viewportSize(), fps, medianFps, runs };
  saveResults("S2A-14-pan-zoom", results);
  await test.info().attach("S2A-14 pan and zoom results", { body: JSON.stringify(results, null, 2), contentType: "application/json" });
});
