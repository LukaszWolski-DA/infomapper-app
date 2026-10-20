// S4B2-10 and S4B2-14's pans (slice 4b-2, section 6; measurement build only: MEASURE=1 MEASURE_BUILD=production,
// `npm run measure:canvas -- --to-screen --only s4b2pans`): pan and zoom, Focus off, at 30 % around ent:23 and in
// S1A-14's 100 % dense view, frames expanded and collapsed; per view one untraced pan (rAF, the calibration) and one
// traced pan as presented frames. On this branch on “Performance test – requirements” (12 requirement cards; S4B2-10)
// and on “100 cards” (none; S4B2-14); in the `slice-04b1` worktree, which has no requirements canvas, on “100 cards”
// only. Self-contained (imports only what `slice-04b1` has too), because `measure:canvas` copies it there. Results in
// test-results/S4B2-10.json.

import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { tracedPan } from "../measure/switches";
import { TO_SCREEN } from "../measure/trace";
import { expect, test, type Page } from "../slice-01a/fixtures";
import { canvasUrl } from "../slice-01a/helpers";
import { MEASURE, MEASURE_USE, panZoom, saveResults, startRecording, stopRecording } from "../slice-01b/measure";
import { signInAs } from "../slice-04a/helpers";

test.use(MEASURE_USE);

const PAN_MS = MEASURE ? 10_000 : 2_000;
/** The requirements canvas, where this branch has it (slice 4b-2, PRD item 26); `slice-04b1` has none. */
const REQUIREMENTS_CANVAS = (LARGE_IDS as Record<string, string>).canvasRequirements;
const CANVASES: Record<string, string> = { ...(REQUIREMENTS_CANVAS ? { "– requirements": REQUIREMENTS_CANVAS } : {}), "100 cards": LARGE_IDS.canvas };

async function open(page: Page, canvasId: string, view: { x: number; y: number; zoom: number }, collapsed: boolean) {
  await page.goto("/sign-in");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${canvasId}`, JSON.stringify(view)] as const);
  const url = canvasUrl(canvasId, LARGE_IDS.project, LARGE_IDS.workspace);
  await page.goto(collapsed ? `${url}?diag=collapsed` : url);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.mouse.move(2, 2);
  await page.waitForTimeout(MEASURE ? 1500 : 300);
}

test("S4B2-10: pan and zoom with requirement cards in view, Focus off, against the same views without them (and S4B2-14's pans)", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(30 * 60_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  await open(page, LARGE_IDS.canvas, { x: 0, y: 0, zoom: 1 }, false);
  const pane = await page.locator(".react-flow__pane").evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
  const data = generate();
  const ent23 = data.cards.find((c) => c.id === "ent:23")!, src57 = data.cards.find((c) => c.id === "src:57")!;
  const around = { x: pane.w / 2 - (ent23.x + ent23.w / 2) * 0.3, y: pane.h / 2 - (ent23.y + 200) * 0.3, zoom: 0.3 };
  // S1A-14's 100 % view (pane coordinates, as S1A-14 writes it)
  const dense = { x: 768 - src57.x, y: 300 - src57.y, zoom: 1 };
  const views = {
    "30 % around ent:23, expanded": { view: around, collapsed: false },
    "100 % dense, expanded": { view: dense, collapsed: false },
    "30 % around ent:23, collapsed": { view: around, collapsed: true },
    "100 % dense, collapsed": { view: dense, collapsed: true },
  };
  const results: Record<string, Record<string, unknown>> = {};
  for (const [canvasName, canvasId] of Object.entries(CANVASES)) {
    results[canvasName] = {};
    for (const [name, v] of Object.entries(views)) {
      await open(page, canvasId, v.view, v.collapsed);
      const inView = {
        requirementCards: await page.locator('[data-testid="card-requirement"]').count(),
        traceLines: await page.locator('[data-testid="line-trace"]').count(),
      };
      await startRecording(page);
      await panZoom(page, PAN_MS);
      const raf = await stopRecording(page);
      let presented: unknown = null;
      if (TO_SCREEN) {
        await open(page, canvasId, v.view, v.collapsed);
        presented = (
          await tracedPan(page, `S4B2-10 ${canvasName} ${name}`, async () => {
            await startRecording(page);
            await panZoom(page, PAN_MS);
            return stopRecording(page);
          })
        ).presented;
      }
      results[canvasName]![name] = { ...inView, raf, presented };
    }
  }
  saveResults("S4B2-10", { measured: MEASURE, toScreen: TO_SCREEN, browser: browser.version(), pane, canvases: results });
});
