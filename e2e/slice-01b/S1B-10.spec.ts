// S1B-10: hovering a row highlights its lines (drawn again above the others) and the rows at their other ends, and
// the other lines do not fade (slice 1b, item 9); C-10 and pan and zoom on “Performance test”. The normal run checks
// the behaviour and runs the steps without judging the speed; the measurement runs with MEASURE=1 (see measure.ts):
//
//   MEASURE=1 npx playwright test e2e/slice-01b/S1B-10.spec.ts
//
// C-10: 40 hovers on the mapped rows in view at 100 % in the spike's dense area (around src:57), each timed until the
// overlay mark is in the page and until the next frame (bar: 100 ms), then the real mouse sweeps over a card for 5 s.
// Pan and zoom: slice 1a's wheel driver, three runs of 10 s at the overview and at 100 %; the median of the three must
// be at most 5 % below slice 1a's median (overview 55.6 → at least 52.8 fps, 100 % 49.5 → at least 47.0 fps).
// Results go to test-results/S1B-10.json. C-10 is partly met on the development laptop (slice 1b decision); the
// production-build measurement is in the Supabase slice (docs/known-limitations.md).

import { seedLargeData } from "../../src/data/local/dev-data";
import { generate } from "../../src/data/local/large-generator";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";
import { canvasUrl, ids, LEFT_AT_100, openCanvas, rowNamed, signInAs } from "./helpers";
import { DIAG, median, MEASURE, MEASURE_USE, NOT_APPLICABLE, openLarge, panZoom, saveResults, startRecording, stopRecording, type FrameStats } from "./measure";

if (MEASURE) test.use(MEASURE_USE);

/** Slice 1a's medians of three runs (S1A-14), and the bars 5 % below them (agreed for slice 1b). */
const PAN_ZOOM_BARS = { overview: 52.8, "100%": 47.0 } as const;

test("S1B-10: hovering a row highlights its lines and far-end rows within 100 ms on “Performance test” (C-10); pan and zoom do not regress against slice 1a: the median of three MEASURE=1 runs is at most 5% below slice 1a's median, separately for overview (55.6 fps → at least 52.8 fps) and 100% (49.5 fps → at least 47.0 fps)", async ({ page, browser }) => {
  test.setTimeout(MEASURE ? 600_000 : 180_000);
  const { model, attribute } = await ids();
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), LEFT_AT_100);

  // Customer.email has two mappings (customers.email_addr and web_users.email)
  const email = attribute("Customer", "email");
  const emailMappings = model.mappings.filter((m) => m.attribute_id === email.id).map((m) => m.id).sort();
  expect(emailMappings).toHaveLength(2);
  const row = (await rowNamed(page, "Customer", "email").boundingBox())!;
  const t0 = Date.now();
  await page.mouse.move(row.x + 40, row.y + row.height / 2);
  // its row and the two rows at the other ends are marked, and the row's connection dots are drawn, in the overlay
  await expect(page.getByTestId("hover-row")).toHaveCount(3);
  const hoverMs = Date.now() - t0;
  await expect(page.getByTestId("layer-hover").locator("circle.hnd")).toHaveCount(2);
  // its two lines are drawn again above the others, a little stronger; the other lines stay as they are
  const drawnAgain = await page.getByTestId("layer-hover-lines").locator('[data-testid="line-mapping"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-mapping")!).sort());
  expect(drawnAgain).toEqual(emailMappings);
  await expect(page.locator(".im-canvas .dimmed")).toHaveCount(0);
  // the cards themselves are not restyled: no row of a card is marked
  await expect(page.locator(".card .row.hl")).toHaveCount(0);
  // leaving the row clears it
  await page.mouse.move(row.x - 200, row.y - 200);
  await expect(page.getByTestId("hover-row")).toHaveCount(0);
  await expect(page.getByTestId("layer-hover-lines")).toHaveCount(0);

  // ---- C-10 on “Performance test”: hover delay on mapped rows at 100 % in the dense area, then a sweep ----
  await seedLargeData(E2E_DB);
  const src57 = generate().cards.find((c) => c.id === "src:57")!;
  const size = page.viewportSize()!;
  await openLarge(page, { x: size.width / 2 - src57.x, y: 300 - src57.y, zoom: 1 });
  // under DIAG=collapsed (S2C-12) the cards are hidden in their blocks: there are no rows to hover
  const collapsed = DIAG === "collapsed";
  const hovers = MEASURE ? 40 : 10;
  const latency = collapsed ? NOT_APPLICABLE : await page.evaluate(async (hovers) => {
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
    for (let k = 0; k < hovers; k++) {
      const r = rows[k % rows.length]!;
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
    return { rows: rows.length, hovers, commitMs: st(commit), toNextFrameMs: st(frame) };
  }, hovers);
  expect(latency).not.toHaveProperty("error");
  let sweep: FrameStats | null = null;
  if (!collapsed) {
    const sweepCard = await page.evaluate(([x, y]) => {
      const n = [...document.querySelectorAll<HTMLElement>(".react-flow__node")].find((e) => e.style.transform === `translate(${x}px, ${y}px)`);
      return n?.dataset.id ?? null;
    }, [src57.x, src57.y] as const);
    const card = (await page.locator(`.react-flow__node[data-id="${sweepCard}"]`).boundingBox())!;
    await startRecording(page);
    const t1 = Date.now();
    let i = 0;
    while (Date.now() - t1 < (MEASURE ? 5000 : 1000)) {
      i++;
      await page.mouse.move(card.x + 60, card.y + 70 + ((i * 7) % Math.min(card.height - 80, 700)));
    }
    sweep = await stopRecording(page);
  }

  // ---- pan and zoom: three runs at the overview (fit) and at 100 % in the dense area ----
  const runs = MEASURE ? 3 : 1;
  const panZoomRuns: Record<keyof typeof PAN_ZOOM_BARS, FrameStats[]> = { overview: [], "100%": [] };
  for (let r = 0; r < runs; r++) {
    for (const [name, view] of [
      ["overview", undefined],
      ["100%", { x: size.width / 2 - src57.x, y: 300 - src57.y, zoom: 1 }],
    ] as const) {
      await openLarge(page, view);
      await startRecording(page);
      await panZoom(page, MEASURE ? 10_000 : 2_000);
      panZoomRuns[name].push(await stopRecording(page));
    }
  }
  const panZoomMedian = {
    overview: median(panZoomRuns.overview.map((x) => x.avgFps)),
    "100%": median(panZoomRuns["100%"].map((x) => x.avgFps)),
  };

  const results = {
    measured: MEASURE,
    browser: browser.version(),
    viewport: page.viewportSize(),
    demoHoverMs: hoverMs,
    "C-10": { ...latency, hoverSweep: sweep },
    panZoom: { runs: panZoomRuns, medianFps: panZoomMedian, bars: PAN_ZOOM_BARS },
  };
  saveResults("S1B-10", results);
  await test.info().attach("S1B-10 results", { body: JSON.stringify(results, null, 2), contentType: "application/json" });
  if (MEASURE && !collapsed) {
    const c10 = latency as { toNextFrameMs: { median: number } };
    expect.soft(c10.toNextFrameMs.median, "C-10: hover to the next frame, median ms (bar 100)").toBeLessThanOrEqual(100);
  }
  if (MEASURE) {
    expect.soft(panZoomMedian.overview, "pan and zoom at the overview, median fps of 3 runs (bar 52.8)").toBeGreaterThanOrEqual(PAN_ZOOM_BARS.overview);
    expect.soft(panZoomMedian["100%"], "pan and zoom at 100 %, median fps of 3 runs (bar 47.0)").toBeGreaterThanOrEqual(PAN_ZOOM_BARS["100%"]);
  }
});
