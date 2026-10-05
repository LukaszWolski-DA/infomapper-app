// Measuring on the "Performance test" workspace (seed:large) for S1B-09 and S1B-10, with the spike's method
// (spikes/canvas-react-flow/tests/measure.spec.ts, as in slice 1a's S1A-14): every requestAnimationFrame interval is
// recorded and the Long Animation Frames API counts long frames. Only meaningful with MEASURE=1 (installed Google
// Chrome, headed, the spike's 1536 × 864, same laptop); the normal e2e run only checks that the steps work.

import fs from "node:fs";
import path from "node:path";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { expect, type Page } from "./fixtures";
import { canvasUrl } from "./helpers";

export const MEASURE = !!process.env.MEASURE;

/** Headed Google Chrome at the spike's window size, kept drawing while another window is in front. */
export const MEASURE_USE = {
  channel: "chrome",
  headless: false,
  viewport: { width: 1536, height: 864 },
  launchOptions: { args: ["--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"] },
};

export const LARGE_URL = canvasUrl(LARGE_IDS.canvas, LARGE_IDS.project, LARGE_IDS.workspace);

export interface FrameStats {
  frames: number;
  durationMs: number;
  avgFps: number;
  maxFrameMs: number;
  p95FrameMs: number;
  over50ms: number;
  longAnimationFrames: number;
}

export async function startRecording(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    const dts: number[] = [];
    const loaf: number[] = [];
    let last = performance.now();
    let on = true;
    const tick = (now: number) => {
      dts.push(now - last);
      last = now;
      if (on) requestAnimationFrame(tick);
    };
    requestAnimationFrame((now) => {
      last = now;
      requestAnimationFrame(tick);
    });
    const obs = new PerformanceObserver((l) => l.getEntries().forEach((e) => loaf.push(e.duration)));
    obs.observe({ type: "long-animation-frame" });
    const t0 = performance.now();
    w.__frames = () => {
      on = false;
      obs.disconnect();
      const ms = performance.now() - t0;
      const sorted = [...dts].sort((a, b) => a - b);
      return {
        frames: dts.length,
        durationMs: Math.round(ms),
        avgFps: +((dts.length * 1000) / ms).toFixed(1),
        maxFrameMs: +(sorted[sorted.length - 1] ?? 0).toFixed(1),
        p95FrameMs: +(sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(1),
        over50ms: dts.filter((d) => d > 50).length,
        longAnimationFrames: loaf.length,
      };
    };
  });
}

export const stopRecording = (page: Page): Promise<FrameStats> =>
  page.evaluate(() => (window as unknown as { __frames: () => FrameStats }).__frames());

/** The spike's in-page wheel driver: one wheel event per frame for `ms`, 1-s segments of pan, zoom in, pan, zoom out. */
export const panZoom = (page: Page, ms: number) =>
  page.evaluate(
    (ms) =>
      new Promise<void>((done) => {
        const pane = document.querySelector(".react-flow__pane")!;
        const r = pane.getBoundingClientRect();
        const t0 = performance.now();
        const step = (now: number) => {
          const t = now - t0;
          if (t > ms) return done();
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

/** Opens the large canvas at a remembered view (none: fit everything) and waits until it is ready and settled. */
export async function openLarge(page: Page, view?: { x: number; y: number; zoom: number }) {
  await page.goto("/sign-in");
  await page.evaluate(
    ([k, v]) => (v ? localStorage.setItem(k, v) : localStorage.removeItem(k)),
    [`infomapper:view:${LARGE_IDS.canvas}`, view ? JSON.stringify(view) : ""] as const,
  );
  await page.goto(LARGE_URL);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.waitForTimeout(MEASURE ? 1500 : 300);
}

export const median = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

/** Writes a run's results to test-results/<name>.json and attaches them to the test report. */
export function saveResults(name: string, results: unknown) {
  const out = path.resolve("test-results", `${name}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(`${name}: ${JSON.stringify(results, null, 2)}`);
}
