// S3B-15 (c): on PERF-2's live canvas from `seed:large` at 100 %, pan and zoom at least as fast as “Performance test”
// in the same sitting. The same 10 s wheel driver and frame recording as S1A-14 (one wheel event per frame, 1-s segments
// of pan, zoom in, pan, zoom out), at 100 %: “Performance test” in S1A-14's dense area (src:57 at 768, 300), the live
// canvas centred on its content. Measured in turns (Performance test, live, live, Performance test), so a machine that
// slows down weighs on both. Measurement build only, headed Chrome (MEASURE=1 MEASURE_BUILD=production, after `npm run
// measure:build`); the normal e2e run leaves this file out (playwright.config.ts). Results in
// test-results/S3B-15-live.json; this spec records, the reading is the acceptance doc's.
import fs from "node:fs";
import path from "node:path";
import { LARGE_IDS, LARGE_LIVE_LABEL } from "../../src/data/local/seed-large";
import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { readDb } from "../../src/data/local/file";
import { E2E_DB } from "../config";
import { expect, test, type Page } from "../slice-01a/fixtures";
import { canvasUrl, signInAs } from "../slice-01a/helpers";

test.use({
  channel: "chrome",
  headless: false,
  viewport: { width: 1536, height: 864 },
  launchOptions: { args: ["--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"] },
});

const OUT = path.resolve("test-results", "S3B-15-live.json");

async function open(page: Page, canvasId: string, view: { x: number; y: number; zoom: number }) {
  await page.goto("/sign-in");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${canvasId}`, JSON.stringify(view)] as const);
  await page.goto(canvasUrl(canvasId, LARGE_IDS.project, LARGE_IDS.workspace));
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.waitForTimeout(1500);
}

/** 10 s of S1A-14's pan and zoom at the open view: average fps and frames over 50 ms. */
const measure = (page: Page, ms: number) =>
  page.evaluate(
    (ms) =>
      new Promise<{ avgFps: number; over50ms: number; frames: number }>((done) => {
        const pane = document.querySelector(".react-flow__pane")!;
        const r = pane.getBoundingClientRect();
        const dts: number[] = [];
        let last = 0;
        const t0 = performance.now();
        const step = (now: number) => {
          if (last) dts.push(now - last);
          last = now;
          const t = now - t0;
          if (t > ms) {
            const total = performance.now() - t0;
            return done({ avgFps: +((dts.length * 1000) / total).toFixed(1), over50ms: dts.filter((d) => d > 50).length, frames: dts.length });
          }
          const seg = Math.floor(t / 1000) % 4;
          const ev: WheelEventInit = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
          if (seg === 0 || seg === 2) Object.assign(ev, { deltaX: 25 * Math.cos(t / 400), deltaY: 25 * Math.sin(t / 400) });
          else Object.assign(ev, { ctrlKey: true, deltaY: seg === 1 ? -3 : 3 });
          pane.dispatchEvent(new WheelEvent("wheel", ev));
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    ms,
  );

test("S3B-15 (c): pan and zoom at 100 % on PERF-2's live canvas against “Performance test”, in turns", async ({ page }) => {
  test.setTimeout(300_000);
  await seedLargeData(E2E_DB);
  const db = await readDb(E2E_DB);
  const label = db.label.find((l) => l.workspace_id === LARGE_IDS.workspace && l.name === LARGE_LIVE_LABEL)!;
  const live = db.canvas.find((c) => c.live_label_id === label.id && c.deleted_at === null)!;
  const items = db.canvas_item.filter((i) => i.canvas_id === live.id && i.deleted_at === null);
  const x0 = Math.min(...items.map((i) => i.x)), x1 = Math.max(...items.map((i) => i.x + (i.width ?? 256)));
  const y0 = Math.min(...items.map((i) => i.y)), y1 = Math.max(...items.map((i) => i.y + 300));
  const liveView = { x: 768 - (x0 + x1) / 2, y: 432 - (y0 + y1) / 2, zoom: 1 };
  const src57 = generate().cards.find((c) => c.id === "src:57")!;
  const perfView = { x: 768 - src57.x, y: 300 - src57.y, zoom: 1 };

  await signInAs(page, "Łukasz");
  const runs: { canvas: "performance test" | "live"; avgFps: number; over50ms: number; frames: number }[] = [];
  for (const which of ["performance test", "live", "live", "performance test"] as const) {
    if (which === "live") await open(page, live.id, liveView);
    else await open(page, LARGE_IDS.canvas, perfView);
    runs.push({ canvas: which, ...(await measure(page, 10_000)) });
  }
  const median = (c: string) => {
    const v = runs.filter((r) => r.canvas === c).map((r) => r.avgFps).sort((a, b) => a - b);
    return +((v[0]! + v[1]!) / 2).toFixed(1);
  };
  const results = { liveCanvas: live.name, cards: items.length, runs, performanceTest: median("performance test"), live: median("live") };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log("S3B-15 live " + JSON.stringify(results));
});
