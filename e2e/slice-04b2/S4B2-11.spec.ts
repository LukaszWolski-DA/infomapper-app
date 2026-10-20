// S4B2-11 (slice 4b-2, section 6; S4B1-11 rerun after T3; measurement build only, `npm run measure:canvas --
// --to-screen --only s4b2focus`): pan and zoom with Focus on against Focus off on “Performance test – requirements”, at
// 30 % and 100 % around ent:23, frames expanded and collapsed; Focus off, on ent:23, on REQ-102. Per case one untraced
// pan (rAF) and, with TO_SCREEN=1, one traced pan as presented frames. Bar: Focus on within 5 % of off (presented); a
// miss is partly met and goes to the performance review. Results in test-results/S4B2-11.json.
// The traced pan starts from the same view as the untraced one (the page opened again, Focus switched on again): the
// spike's 10 s driver ends on a zoom-in segment, so a pan that follows another starts zoomed far in (step 8's smoke;
// S4P-fading's pans with fading on followed the untraced pan that way).

import { seedLargeData } from "../../src/data/local/dev-data";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { tracedPan } from "../measure/switches";
import { TO_SCREEN } from "../measure/trace";
import { MEASURE, MEASURE_USE, panZoom, saveResults, startRecording, stopRecording } from "../slice-01b/measure";
import { expect, test, type Page } from "./fixtures";
import { signInAs } from "./helpers";
import { aroundEnt23, fade, focusEntity, focusRequirement, openReq, paneSize, type View } from "./measure";

test.use(MEASURE_USE);
const PAN_MS = MEASURE ? 10_000 : 2_000;

const pan = async (page: Page) => {
  await startRecording(page);
  await panZoom(page, PAN_MS);
  return stopRecording(page);
};

test("S4B2-11: pan and zoom with Focus on against off, with requirement cards, 30 % and 100 %, frames expanded and collapsed", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(45 * 60_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  await openReq(page, { x: 0, y: 0, zoom: 1 });
  const pane = await paneSize(page);
  const cases = { off: null, "ent:23": focusEntity("ent:23"), "REQ-102": focusRequirement("REQ-102") } as const;
  const results: Record<string, Record<string, unknown>> = {};
  for (const collapsed of [false, true])
    for (const zoom of [0.3, 1]) {
      const name = `${zoom * 100} %, ${collapsed ? "collapsed" : "expanded"}`;
      const view: View = aroundEnt23(pane, zoom);
      results[name] = {};
      for (const [c, focus] of Object.entries(cases)) {
        const ready = async () => {
          await openReq(page, view, collapsed);
          if (focus) expect(await fade(page, focus.request, focus.key), `${name} ${c}: Focus shown`).toBe(true);
          await page.waitForTimeout(MEASURE ? 1000 : 200);
        };
        await ready();
        const litCards = await page.evaluate(() => document.querySelector<HTMLElement>('[data-testid="layer-fade"]')?.dataset.litCards ?? null);
        const litTraces = await page.locator('[data-testid="lit-trace"]').count();
        const raf = await pan(page);
        const zoomAfterPan = await page.getByTestId("value-zoom").textContent();
        let presented: unknown = null;
        if (TO_SCREEN) {
          await ready();
          presented = (await tracedPan(page, `S4B2-11 ${name} ${c}`, () => pan(page))).presented;
        }
        results[name]![c] = { litCards, litTraces, raf, zoomAfterPan, presented };
      }
    }
  saveResults("S4B2-11", { measured: MEASURE, toScreen: TO_SCREEN, browser: browser.version(), pane, views: results });
});
