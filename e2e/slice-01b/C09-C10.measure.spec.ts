// Quick check of the spike's C-09 (card resize) and C-10 (hover highlight delay) on the "Performance test" workspace
// (seed:large), after step 4 of slice 1b. Runs only with MEASURE=1 (headed Google Chrome, the spike's 1536 × 864):
//
//   MEASURE=1 npx playwright test e2e/slice-01b/C09-C10.measure.spec.ts
//
// The spike's method (spikes/canvas-react-flow/tests/measure.spec.ts): C-09 drags the width handle of the card with
// 200 rows back and forth for 6 s and records every frame; C-10 dispatches a hover on up to 40 mapped rows in view and
// times until the overlay mark is in the page and until the next frame, then sweeps the real mouse over a card for
// 5 s. Results go to test-results/S1B-C09-C10.json. The full measurement with its bars is step 6 (S1B-09, S1B-10).

import fs from "node:fs";
import path from "node:path";
import { seedLargeData } from "../../src/data/local/dev-data";
import { generate } from "../../src/data/local/large-generator";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB } from "../config";
import { expect, test, type Page } from "../slice-01a/fixtures";
import { canvasUrl, signInAs } from "../slice-01a/helpers";

const MEASURE = !!process.env.MEASURE;
test.skip(!MEASURE, "measurement only: MEASURE=1");
test.use({
  channel: "chrome",
  headless: false,
  viewport: { width: 1536, height: 864 },
  launchOptions: { args: ["--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"] },
});

const url = canvasUrl(LARGE_IDS.canvas, LARGE_IDS.project, LARGE_IDS.workspace);
const OUT = path.resolve("test-results", "S1B-C09-C10.json");

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
    w.__rec = () => {
      on = false;
      obs.disconnect();
      const ms = performance.now() - t0;
      const sorted = [...dts].sort((a, b) => a - b);
      return {
        frames: dts.length,
        avgFps: +((dts.length * 1000) / ms).toFixed(1),
        maxFrameMs: +(sorted[sorted.length - 1] ?? 0).toFixed(1),
        p95FrameMs: +(sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(1),
        over50ms: dts.filter((d) => d > 50).length,
      };
    };
  });
}
const stopRecording = (page: Page) => page.evaluate(() => (window as unknown as { __rec: () => Record<string, number> }).__rec());

async function open(page: Page, view: { x: number; y: number; zoom: number }) {
  await page.goto("/sign-in");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${LARGE_IDS.canvas}`, JSON.stringify(view)] as const);
  await page.goto(url);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.waitForTimeout(1500);
}

/** The card with the most rows (the spike's 200-row entity) and its canvas position. */
const bigCard = (page: Page) =>
  page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>(".react-flow__node")];
    const n = nodes.sort((a, b) => b.querySelectorAll(".row[data-row]").length - a.querySelectorAll(".row[data-row]").length)[0]!;
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(n.style.transform)!;
    return { id: n.dataset.id!, x: +m[1]!, y: +m[2]!, w: n.offsetWidth, rows: n.querySelectorAll(".row[data-row]").length };
  });

test("C-09 and C-10 quick check on Performance test (slice 1b, step 4)", async ({ page, browser }) => {
  test.setTimeout(300_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  const results: Record<string, unknown> = { browser: browser.version(), viewport: page.viewportSize() };

  // ---- C-09: the 200-row card's width handle, at 50 % like the spike ----
  await open(page, { x: 0, y: 0, zoom: 0.5 });
  const card = await bigCard(page);
  await open(page, { x: 768 - (card.x + card.w / 2) * 0.5, y: 120 - card.y * 0.5, zoom: 0.5 });
  const handle = page.locator(`.react-flow__node[data-id="${card.id}"] [data-testid="handle-card-width"]`);
  const hb = (await handle.boundingBox())!;
  const edge = { x: hb.x + hb.width / 2, y: hb.y + 300 };
  await page.mouse.move(edge.x, edge.y);
  await page.mouse.down();
  await startRecording(page);
  const t0 = Date.now();
  let a = 0;
  while (Date.now() - t0 < 6000) {
    a += 0.05;
    await page.mouse.move(edge.x + 90 * Math.sin(a) + 60, edge.y);
  }
  const resize = await stopRecording(page);
  await page.mouse.up();
  results["C-09"] = { card: { rows: card.rows }, resize };

  // ---- C-10: hover delay on mapped rows at 100 % in the spike's dense area (around src:57), then a sweep ----
  const src57 = generate().cards.find((c) => c.id === "src:57")!;
  await open(page, { x: 768 - src57.x, y: 300 - src57.y, zoom: 1 });
  const latency = await page.evaluate(async () => {
    const pane = document.querySelector(".react-flow__pane")!;
    const p = pane.getBoundingClientRect();
    const rows = [...document.querySelectorAll<HTMLElement>(".row[data-row]")]
      .filter((r) => {
        const b = r.getBoundingClientRect();
        return b.top > p.top + 10 && b.bottom < p.bottom - 10 && b.left > p.left && b.right < p.right && r.querySelector(".st.ok, .st.warn");
      })
      .slice(0, 40);
    if (!rows.length) return { error: "no mapped rows in view" };
    const commit: number[] = [], frame: number[] = [];
    for (const r of rows) {
      // React renders a hover at continuous priority: wait for the overlay mark, then for the frame that shows it
      const t0 = performance.now();
      r.querySelector(".nm")!.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
      while (!document.querySelector('[data-testid="hover-row"]') && performance.now() - t0 < 2000) await new Promise((res) => setTimeout(res, 0));
      if (!document.querySelector('[data-testid="hover-row"]')) return { error: "row not highlighted " + r.dataset.row };
      commit.push(performance.now() - t0);
      await new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
      frame.push(performance.now() - t0);
      pane.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
      await new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
    }
    const st = (xs: number[]) => {
      const s = [...xs].sort((a, b) => a - b);
      return { median: +s[Math.floor(s.length / 2)]!.toFixed(1), p95: +s[Math.floor(s.length * 0.95)]!.toFixed(1), max: +s[s.length - 1]!.toFixed(1) };
    };
    return { rows: rows.length, commitMs: st(commit), toNextFrameMs: st(frame) };
  });
  const sweepCard = await page.evaluate(([x, y]) => {
    const n = [...document.querySelectorAll<HTMLElement>(".react-flow__node")].find((e) => e.style.transform === `translate(${x}px, ${y}px)`);
    return n?.dataset.id ?? null;
  }, [src57.x, src57.y] as const);
  const box = (await page.locator(`.react-flow__node[data-id="${sweepCard}"]`).boundingBox())!;
  await startRecording(page);
  const t1 = Date.now();
  let i = 0;
  while (Date.now() - t1 < 5000) {
    i++;
    await page.mouse.move(box.x + 60, box.y + 70 + ((i * 7) % Math.min(box.height - 80, 700)));
  }
  const sweep = await stopRecording(page);
  results["C-10"] = { ...latency, hoverSweep: sweep };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  expect(latency).not.toHaveProperty("error");
});
