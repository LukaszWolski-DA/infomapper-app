// S1A-14: the canvas spike's C-01 (pan and zoom) and C-08 (initial render), repeated in the application on the
// "Performance test" workspace (seed:large, the spike's data set).
//
// In the normal e2e run this test checks that the large canvas opens completely (every card and line drawn, detail
// by zoom level at the overview) and records the numbers without judging them: headless Chromium has no GPU.
// The measurement proper runs with MEASURE=1 in installed Google Chrome, headed, at the spike's 1536 × 864, and
// asserts the bars:
//
//   MEASURE=1 npx playwright test e2e/slice-01a/S1A-14.spec.ts
//
// It uses the spike's method: every requestAnimationFrame interval is recorded and the Long Animation Frames API
// counts frames over 50 ms, while one wheel event per frame alternates 1-s segments of pan, zoom in, pan, zoom out
// for 10 s. Results go to test-results/S1A-14.json.

import fs from "node:fs";
import path from "node:path";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { E2E_DB } from "../config";
import { expect, test, type Page } from "./fixtures";
import { canvasUrl, loadModel, signInAs, store, zoomOf } from "./helpers";

const MEASURE = !!process.env.MEASURE;
const VIEWPORT = { width: 1536, height: 864 };
if (MEASURE) {
  test.use({
    channel: "chrome",
    headless: false,
    viewport: VIEWPORT,
    launchOptions: { args: ["--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"] },
  });
}

const url = canvasUrl(LARGE_IDS.canvas, LARGE_IDS.project, LARGE_IDS.workspace);
const OUT = path.resolve("test-results", "S1A-14.json");

async function startRecording(page: Page) {
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
    w.__s1a14 = () => {
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
const stopRecording = (page: Page) =>
  page.evaluate(() => (window as unknown as { __s1a14: () => Record<string, number> }).__s1a14());

/** The spike's in-page wheel driver: one wheel event per frame for `ms`, 1-s segments of pan, zoom in, pan, zoom out. */
const panZoom = (page: Page, ms: number) =>
  page.evaluate(
    (ms) =>
      new Promise<{ minZoom: number; maxZoom: number }>((done) => {
        const pane = document.querySelector(".react-flow__pane")!;
        const viewport = document.querySelector<HTMLElement>(".react-flow__viewport")!;
        const r = pane.getBoundingClientRect();
        let minZoom = 99, maxZoom = 0;
        const t0 = performance.now();
        const step = (now: number) => {
          const t = now - t0;
          if (t > ms) return done({ minZoom, maxZoom });
          const seg = Math.floor(t / 1000) % 4;
          const ev: WheelEventInit = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
          if (seg === 0 || seg === 2) Object.assign(ev, { deltaX: 25 * Math.cos(t / 400), deltaY: 25 * Math.sin(t / 400) });
          else Object.assign(ev, { ctrlKey: true, deltaY: seg === 1 ? -3 : 3 });
          pane.dispatchEvent(new WheelEvent("wheel", ev));
          const z = Number(/scale\(([\d.]+)\)/.exec(viewport.style.transform)?.[1] ?? 1);
          minZoom = Math.min(minZoom, z);
          maxZoom = Math.max(maxZoom, z);
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    ms,
  );

/** Opens the canvas with a remembered view (or none: fit everything), and waits until it is ready. */
async function open(page: Page, view?: { x: number; y: number; zoom: number }) {
  await page.goto("/sign-in");
  await page.evaluate(
    ([k, v]) => (v ? localStorage.setItem(k, v) : localStorage.removeItem(k)),
    [`infomapper:view:${LARGE_IDS.canvas}`, view ? JSON.stringify(view) : ""] as const,
  );
  await page.goto(url);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
}

test("S1A-14: performance on seed:large, Chrome, same laptop as the spike: pan and zoom at least 50 fps on average with no frame over 50 ms, at overview and at 100%; initial render under 1.5 s", async ({ page, browser }) => {
  test.setTimeout(MEASURE ? 600_000 : 240_000);
  await seedLargeData(E2E_DB);
  const model = await loadModel(LARGE_IDS.workspace);
  const cards = (await store().canvasItems.listOfCanvas(LARGE_IDS.workspace, LARGE_IDS.canvas)).length;
  const lines = model.mappings.length + model.relationships.length;
  expect(cards).toBe(101);
  expect(lines).toBe(340);

  await signInAs(page, "Łukasz");
  const results: Record<string, unknown> = { measured: MEASURE, browser: browser.version(), viewport: page.viewportSize() };
  results.environment = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return { gpu: ext ? gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown", dpr: devicePixelRatio, cores: navigator.hardwareConcurrency };
  });

  // the whole canvas is drawn: every card and line; at the overview zoom cards show a plain block
  await open(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(cards);
  await expect(page.locator('[data-testid="line-mapping"], [data-testid="line-relationship"]')).toHaveCount(lines);
  const fitZoom = await zoomOf(page);
  expect(fitZoom).toBeLessThan(0.4);
  await expect(page.getByTestId("card-block")).toHaveCount(cards);

  // C-01: pan and zoom, 10 s each, at the overview (fit) and at 100% in the spike's dense area (around src:57)
  const src57 = generate().cards.find((c) => c.id === "src:57")!;
  const views: [string, { x: number; y: number; zoom: number } | undefined][] = [
    ["overview (all cards in view)", undefined],
    ["100%, dense area", { x: 768 - src57.x, y: 300 - src57.y, zoom: 1 }],
  ];
  const c01: Record<string, unknown> = {};
  for (const [name, view] of views) {
    await open(page, view);
    await page.waitForTimeout(MEASURE ? 1500 : 300);
    await startRecording(page);
    const range = await panZoom(page, MEASURE ? 10_000 : 2_000);
    c01[name] = { ...(await stopRecording(page)), zoomRange: [+range.minZoom.toFixed(2), +range.maxZoom.toFixed(2)] };
  }
  results["C-01"] = c01;

  // C-08: navigation start to the first frame with every card shown and every line drawn; one warm-up load (the dev
  // server compiles on first use), then 5 cold loads in fresh browser contexts
  const loads: number[] = [];
  for (let i = 0; i < 6; i++) {
    const context = await browser.newContext({ viewport: page.viewportSize() ?? VIEWPORT, storageState: await page.context().storageState() });
    const p = await context.newPage();
    await p.addInitScript(
      ([cards, lines]) => {
        const w = window as unknown as { __stableAt?: number };
        const check = () => {
          const ready =
            document.querySelector('[data-testid="area-canvas"][data-ready="true"]') &&
            document.querySelectorAll(".react-flow__node").length === cards &&
            document.querySelectorAll('[data-testid="line-mapping"], [data-testid="line-relationship"]').length === lines;
          if (ready) requestAnimationFrame((t) => (w.__stableAt = t));
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      },
      [cards, lines] as const,
    );
    await p.goto(url);
    await p.waitForFunction(() => (window as unknown as { __stableAt?: number }).__stableAt, undefined, { timeout: 60_000 });
    if (i > 0) loads.push(Math.round(await p.evaluate(() => (window as unknown as { __stableAt: number }).__stableAt)));
    await context.close();
  }
  const sorted = [...loads].sort((a, b) => a - b);
  results["C-08"] = { msFromNavigationStart: loads, median: sorted[2], max: sorted[4] };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  await test.info().attach("S1A-14 results", { body: JSON.stringify(results, null, 2), contentType: "application/json" });

  if (MEASURE) {
    for (const r of Object.values(c01) as { avgFps: number; over50ms: number }[]) {
      expect.soft(r.avgFps, "average fps").toBeGreaterThanOrEqual(50);
      expect.soft(r.over50ms, "frames over 50 ms").toBe(0);
    }
    expect.soft(sorted[2]!, "initial render, median ms").toBeLessThan(1500);
  }
});
