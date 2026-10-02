import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { checkMappingEnds, fitNodes, nodeBox, openCanvas, setViewport, toScreen } from "./helpers";

/*
 * Measurements for C-01, C-02, C-04, C-08, C-09, C-10 (and screenshots for C-04, C-11).
 * Runs in installed Google Chrome, headed (project "measure"). Results go to report/results.json.
 *
 * Frame timing: the app's FPS readout (window.__perf) records every requestAnimationFrame interval;
 * in addition the Long Animation Frames API counts frames longer than 50 ms.
 */

test.use({ launchOptions: { args: ["--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"] } });
test.describe.configure({ mode: "serial" });

const OUT = process.env.SPIKE_OUT ?? "report/results.json";
function save(key: string, value: unknown) {
  const all = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  all[key] = value;
  fs.writeFileSync(OUT, JSON.stringify(all, null, 2));
}

async function startRec(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__loaf = [];
    w.__loafObs = new PerformanceObserver(l => l.getEntries().forEach(e => w.__loaf.push(e.duration)));
    w.__loafObs.observe({ type: "long-animation-frame" });
    w.__perf.start();
  });
}
async function stopRec(page: Page) {
  return page.evaluate(() => {
    const w = window as any;
    const r = w.__perf.stop();
    w.__loafObs.disconnect();
    return { ...r, longFrames: w.__loaf.length, longestLoafMs: Math.round(Math.max(0, ...w.__loaf)), zoom: +w.__spike.rf.getZoom().toFixed(3) };
  });
}

/** In-page wheel driver: one wheel event per frame for `ms`, alternating 1-s segments of pan and zoom in/out. */
const panZoom = (page: Page, ms: number, zoomFactor = 1) =>
  page.evaluate(([ms, zf]) => new Promise<{ minZoom: number; maxZoom: number }>(done => {
    const pane = document.querySelector(".react-flow__pane")!;
    const r = pane.getBoundingClientRect();
    const { rf } = (window as any).__spike;
    let minZoom = 99, maxZoom = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = now - t0;
      if (t > ms) return done({ minZoom, maxZoom });
      const seg = Math.floor(t / 1000) % 4; // 0 pan, 1 zoom in, 2 pan, 3 zoom out
      const ev: WheelEventInit = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
      if (seg === 0 || seg === 2) Object.assign(ev, { deltaX: 25 * Math.cos(t / 400), deltaY: 25 * Math.sin(t / 400) });
      else Object.assign(ev, { ctrlKey: true, deltaY: (seg === 1 ? -3 : 3) * (zf as number) });
      pane.dispatchEvent(new WheelEvent("wheel", ev));
      const z = rf.getZoom(); minZoom = Math.min(minZoom, z); maxZoom = Math.max(maxZoom, z);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), [ms, zoomFactor] as const);

/** Real mouse drag in circles for `ms`. */
async function dragCircles(page: Page, from: { x: number; y: number }, ms: number, radius = 120) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const t0 = Date.now();
  let a = 0;
  while (Date.now() - t0 < ms) {
    a += 0.08;
    await page.mouse.move(from.x + radius * Math.sin(a), from.y + radius * (1 - Math.cos(a)) * 0.6);
  }
  await page.mouse.up();
}

test("environment", async ({ page, browser }) => {
  await openCanvas(page);
  const env = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return { gpu: ext ? gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown", dpr: devicePixelRatio, cores: navigator.hardwareConcurrency, viewport: [innerWidth, innerHeight] };
  });
  save("environment", { browser: `Chrome ${browser.version()}`, headed: true, build: "next build + next start (production)", ...env });
});

test("C-01 pan and zoom, full data set", async ({ page }) => {
  const res: Record<string, unknown> = {};
  const overview = async () => { await page.evaluate(() => (window as any).__spike.rf.fitView()); };
  const dense = async () => { const b = await nodeBox(page, "src:57"); await setViewport(page, 768 - b.x, 300 - b.y, 1); };
  for (const [name, query, setup] of [
    ["final: overview (all 101 cards in view)", "", overview],
    ["final: 100% zoom, dense area", "", dense],
    ["vanilla (no will-change, dotted background): overview", "?wc=off&bg=dots", overview],
    ["vanilla (no will-change, dotted background): 100%", "?wc=off&bg=dots", dense],
    ["final + onlyRenderVisibleElements: 100%", "?visibleOnly", dense],
  ] as const) {
    await openCanvas(page, query);
    await setup();
    await page.waitForTimeout(500);
    await startRec(page);
    const range = await panZoom(page, 10_000);
    res[name] = { ...(await stopRec(page)), zoomRange: [+range.minZoom.toFixed(2), +range.maxZoom.toFixed(2)] };
  }
  save("C-01", res);
});

test("C-02 drag one card and a 15-card group", async ({ page }) => {
  await openCanvas(page);
  const b = await nodeBox(page, "src:57");
  await setViewport(page, 768 - b.x - 128, 330 - b.y, 0.6);
  const res: Record<string, unknown> = {};

  const head = (await page.locator('[data-card="src:57"] .c-name').boundingBox())!;
  await startRec(page);
  await dragCircles(page, { x: head.x + 20, y: head.y + 6 }, 8000);
  res["one card (src:57, 11 lines)"] = await stopRec(page);

  // select the 15 cards closest to src:57 (includes cards from several frames)
  const ids: string[] = await page.evaluate(() => {
    const { rf } = (window as any).__spike;
    const p = (id: string) => rf.getInternalNode(id).internals.positionAbsolute;
    const o = p("src:57");
    const cards = rf.getNodes().filter((n: any) => n.type === "card").map((n: any) => n.id);
    const pick = cards.sort((a: string, b: string) => Math.hypot(p(a).x - o.x, p(a).y - o.y) - Math.hypot(p(b).x - o.x, p(b).y - o.y)).slice(0, 15);
    rf.setNodes((ns: any[]) => ns.map(n => ({ ...n, selected: pick.includes(n.id) })));
    return pick;
  });
  await page.waitForTimeout(300);
  const lines = await page.evaluate(ids => (window as any).__spike.data.mappings.filter((m: any) => ids.includes(m.srcCard) || ids.includes(m.entCard)).length, ids);
  const head2 = (await page.locator('[data-card="src:57"] .c-name').boundingBox())!;
  await startRec(page);
  await dragCircles(page, { x: head2.x + 20, y: head2.y + 6 }, 8000);
  res[`15-card group (${lines} mapping lines attached)`] = await stopRec(page);
  expect((await page.evaluate(() => (window as any).__spike.rf.getNodes().filter((n: any) => n.selected).length))).toBe(15);
  save("C-02", res);
});

test("C-04 the 200-row card: pan along it, lines stay attached", async ({ page }) => {
  await openCanvas(page);
  await fitNodes(page, ["ent:40"], 0.05);
  await page.screenshot({ path: "report/c04-200-rows-whole.png" });
  const b = await nodeBox(page, "ent:40");
  await setViewport(page, 768 - b.x - 128, 60 - b.y, 1);
  await page.screenshot({ path: "report/c04-200-rows-100.png" });
  // pan down the full 5 266 px and back with the wheel, one event per frame
  await startRec(page);
  await page.evaluate(() => new Promise<void>(done => {
    const pane = document.querySelector(".react-flow__pane")!;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = now - t0;
      if (t > 10_000) return done();
      pane.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: t < 5000 ? 40 : -40, deltaX: 4 * Math.sin(t / 300) }));
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }));
  const rec = await stopRec(page);
  const maps: string[] = await page.evaluate(() => (window as any).__spike.data.mappings.filter((m: any) => m.entCard === "ent:40").map((m: any) => m.id));
  const ends = await checkMappingEnds(page, maps);
  save("C-04", { pan: rec, cardHeightPx: b.h, mappingsOnCard: maps.length, endsChecked: ends.checked, endsOff: ends.bad.length });
  expect(ends.bad).toEqual([]);
});

test("C-08 initial render of the full data set (5 cold loads)", async ({ browser }) => {
  const runs: number[] = [];
  for (let i = 0; i < 5; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1536, height: 864 } });
    const page = await ctx.newPage();
    // record the first frame after every node is measured and visible and all 340 lines are drawn
    await page.addInitScript(() => {
      const w = window as any;
      const check = () => {
        const nodes = document.querySelectorAll(".react-flow__node");
        const ready = nodes.length === 109 && document.querySelectorAll(".lnk").length === 340 &&
          ![...nodes].some(n => (n as HTMLElement).style.visibility === "hidden");
        if (ready) requestAnimationFrame(t => (w.__stableAt = t));
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
    await page.goto("/");
    await page.waitForFunction(() => (window as any).__stableAt);
    runs.push(Math.round(await page.evaluate(() => (window as any).__stableAt)));
    if (i === 0) await page.screenshot({ path: "report/c08-first-stable-frame.png" });
    await ctx.close();
  }
  const sorted = [...runs].sort((a, b) => a - b);
  save("C-08", { msFromNavigationStart: runs, median: sorted[2], max: sorted[4] });
});

test("C-09 card width resize with 25 mapped rows, lines follow live", async ({ page }) => {
  await openCanvas(page);
  // put the 200-row card (25 mapped rows) in the middle so lines leave on both sides
  await page.evaluate(() => (window as any).__spike.rf.updateNode("ent:40", { position: { x: 2400, y: 600 } }));
  await page.waitForTimeout(300);
  await setViewport(page, 768 - 2400 * 0.5 - 128, 120 - 600 * 0.5, 0.5);
  const b = await nodeBox(page, "ent:40");
  const edge = await toScreen(page, b.x + b.w, b.y + 300);
  const sideEnds = () => page.evaluate(() => {
    const { data, rf } = (window as any).__spike;
    const n = rf.getInternalNode("ent:40");
    const left = n.internals.positionAbsolute.x, right = left + n.measured.width;
    const xs = data.mappings.filter((m: any) => m.entCard === "ent:40").map((m: any) => +(document.querySelector(`[data-edge="${m.id}"]`) as SVGGElement).dataset.x1!);
    return { width: n.measured.width, onRight: xs.filter((x: number) => Math.abs(x - right) < 0.5).length, onLeft: xs.filter((x: number) => Math.abs(x - left) < 0.5).length, total: xs.length };
  });
  await page.mouse.move(edge.x, edge.y);
  await page.mouse.down();
  await startRec(page);
  const samples: unknown[] = [];
  const t0 = Date.now();
  let a = 0, n = 0;
  while (Date.now() - t0 < 6000) {
    a += 0.05;
    await page.mouse.move(edge.x + 90 * Math.sin(a) + 60, edge.y);
    if (++n % 40 === 0 && samples.length < 6) samples.push(await sideEnds());
  }
  const rec = await stopRec(page);
  await page.mouse.up();
  const final = await sideEnds();
  save("C-09", { resize: rec, midDragSamples: samples, final });
  for (const s of samples as any[]) expect(s.onLeft + s.onRight).toBe(s.total);
});

test("C-10 row hover highlight latency", async ({ page }) => {
  await openCanvas(page);
  const b = await nodeBox(page, "src:57");
  await setViewport(page, 768 - b.x - 128, 120 - b.y, 1);
  // in-page: dispatch mouseover on 40 mapped rows on screen; time to React commit and to the next frame
  const lat = await page.evaluate(async () => {
    const { data } = (window as any).__spike;
    const rows = [...document.querySelectorAll<HTMLElement>("[data-row]")].filter(r => {
      const b = r.getBoundingClientRect();
      return b.top > 60 && b.bottom < innerHeight && b.left > 0 && b.right < innerWidth &&
        data.mappings.some((m: any) => m.column === r.dataset.row || m.attribute === r.dataset.row);
    }).slice(0, 40);
    const commit: number[] = [], frame: number[] = [];
    for (const r of rows) {
      const t0 = performance.now();
      r.querySelector(".nm")!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      await Promise.resolve();
      const ok = r.classList.contains("hl");
      commit.push(performance.now() - t0);
      await new Promise(res => requestAnimationFrame(() => setTimeout(res, 0)));
      frame.push(performance.now() - t0);
      if (!ok) return { error: "row not highlighted " + r.dataset.row };
      // React derives mouseleave from mouseout + relatedTarget
      r.querySelector(".nm")!.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.querySelector(".react-flow__pane") }));
      await new Promise(res => requestAnimationFrame(() => setTimeout(res, 0)));
    }
    const st = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return { median: +s[Math.floor(s.length / 2)].toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), max: +s[s.length - 1].toFixed(1) }; };
    return { rows: rows.length, commitMs: st(commit), toNextFrameMs: st(frame) };
  });
  // continuous hover sweep with the real mouse over a column of rows
  const card = (await page.locator('[data-card="src:57"]').boundingBox())!;
  await startRec(page);
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < 5000) {
    i++;
    await page.mouse.move(card.x + 60, card.y + 70 + ((i * 7) % Math.min(card.height - 80, 700)));
  }
  const sweep = await stopRec(page);
  save("C-10", { ...lat, hoverSweep: sweep });
  await page.mouse.move(card.x + 60, card.y + 70 + 26 * 4);
  await page.waitForTimeout(200);
  await page.screenshot({ path: "report/c10-hover.png" });
});

test("C-11 screenshots of crow's-foot and UML ends at 300%", async ({ page }) => {
  await openCanvas(page);
  const b = await nodeBox(page, "ent:28");
  for (const n of ["ie", "uml"]) {
    await page.click(`[data-notation="${n}"]`);
    await setViewport(page, 768 - (b.x - 20) * 3, 432 - (b.y + 27) * 3, 3);
    await page.screenshot({ path: `report/c11-${n}-300.png`, clip: { x: 468, y: 282, width: 600, height: 300 } });
  }
  await page.click('[data-notation="ie"]');
  await fitNodes(page, ["ent:23", "ent:28"], 0.15);
  await page.screenshot({ path: "report/c11-labels.png" });
});
