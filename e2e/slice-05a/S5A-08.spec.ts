// S5A-08 (slice 5a, section 6): the diagnosis to the screen, measurement build only (MEASURE=1
// MEASURE_BUILD=production, after `npm run measure:build`; no laptop preparation, the figures are diagnostic). On
// “Performance test” at 30 % around ent:23 and in S1A-14's 100 % dense view, frames expanded, SETTLED_PAIRS times
// each, from a settled screen: hiding and showing each panel (its toolbar button) and a resize on release of each grip
// (100 px wider, then back). The drag is driven in the page, one pointer move per frame (AD-24 “Measuring”: Playwright's
// mouse slows the display compositor); the switch is timed from the pointerup to the first GPU present after its
// commit (e2e/measure). Bar: ≤ 100 ms median. A LayerTree read with the panels shown, the left one hidden, both hidden
// and the guide line showing counts the drawing layers. Results in test-results/S5A-08.json; raw traces in
// .data/measure/ (git-ignored).

import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { LARGE_URL, MEASURE, MEASURE_USE, saveResults } from "../slice-01b/measure";
import { tracedSwitches, type InPage } from "../measure/switches";
import { PAUSE_MS, SETTLED_PAIRS } from "../measure/trace";
import { expect, test, type Page } from "./fixtures";
import { signInAs } from "./helpers";

test.use(MEASURE_USE);

type Side = "left" | "right";

async function open(page: Page, view: { x: number; y: number; zoom: number }) {
  await page.goto("/sign-in");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`infomapper:view:${LARGE_IDS.canvas}`, JSON.stringify(view)] as const);
  await page.goto(LARGE_URL);
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.mouse.move(2, 400);
  await page.waitForTimeout(MEASURE ? 1500 : 300);
}

/** A panel's toolbar button: hidden (on), then shown (off), `n` times, each from a settled screen. */
const toggleLoop = (page: Page, side: Side, n: number, pause = PAUSE_MS) =>
  page.evaluate(
    async ([side, n, pause]) => {
      const button = document.querySelector<HTMLElement>(`[data-testid="button-toggle-${side}"]`)!;
      const panel = document.querySelector<HTMLElement>(side === "left" ? '[data-testid="panel-left"]' : '[data-testid="panel-inspector"]')!;
      const nextFrame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
      const out: { dir: string; k: number; ms: number }[] = [];
      for (let k = 0; k < n; k++) {
        for (const dir of ["on", "off"] as const) {
          const t0 = performance.now();
          button.click();
          const done = () => (dir === "on" ? panel.getBoundingClientRect().width < 2 : panel.getBoundingClientRect().width > 100);
          while (!done() && performance.now() - t0 < 2000) await new Promise((res) => setTimeout(res, 0));
          if (!done()) return { error: `${side} ${dir} ${k}: not switched` };
          await nextFrame();
          const t1 = performance.now();
          performance.measure(`sw:${dir}:${k}`, { start: t0, end: t1 });
          out.push({ dir, k, ms: +(t1 - t0).toFixed(1) });
          await new Promise((res) => setTimeout(res, pause));
        }
      }
      return out;
    },
    [side, n, pause] as const,
  ) as Promise<InPage>;

/**
 * A grip dragged in the page, one pointer move per frame, 100 px wider (on) and back (off); the switch is the release,
 * from a settled screen (the guide line drawn and settled first), `n` times.
 */
const resizeLoop = (page: Page, side: Side, n: number, pause = PAUSE_MS) =>
  page.evaluate(
    async ([side, n, pause]) => {
      const grip = document.querySelector<HTMLElement>(`[data-testid="grip-${side}"]`)!;
      const panel = document.querySelector<HTMLElement>(side === "left" ? '[data-testid="panel-left"]' : '[data-testid="panel-inspector"]')!;
      const frame = () => new Promise((res) => requestAnimationFrame(res));
      const nextFrame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
      const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
      const fire = (type: string, x: number, y: number) =>
        grip.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: "mouse", button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: x, clientY: y, isPrimary: true }));
      const grow = side === "left" ? 1 : -1;
      const out: { dir: string; k: number; ms: number }[] = [];
      for (let k = 0; k < n; k++) {
        for (const dir of ["on", "off"] as const) {
          const w0 = Math.round(panel.getBoundingClientRect().width);
          const target = w0 + (dir === "on" ? 100 : -100);
          const g = grip.getBoundingClientRect();
          const x0 = g.x + g.width / 2, y = g.y + g.height / 2, dx = grow * (target - w0);
          fire("pointerdown", x0, y);
          for (let i = 1; i <= 12; i++) {
            await frame();
            fire("pointermove", x0 + (dx * i) / 12, y);
          }
          await sleep(pause);
          const t0 = performance.now();
          fire("pointerup", x0 + dx, y);
          const done = () => Math.abs(panel.getBoundingClientRect().width - target) < 1;
          while (!done() && performance.now() - t0 < 2000) await new Promise((res) => setTimeout(res, 0));
          if (!done()) return { error: `${side} resize ${dir} ${k}: width ${panel.getBoundingClientRect().width}, not ${target}` };
          await nextFrame();
          const t1 = performance.now();
          performance.measure(`sw:${dir}:${k}`, { start: t0, end: t1 });
          out.push({ dir, k, ms: +(t1 - t0).toFixed(1) });
          await sleep(pause);
        }
      }
      return out;
    },
    [side, n, pause] as const,
  ) as Promise<InPage>;

/** Drawing layers and their megapixels (CDP LayerTree), as S4B2-15 reads them. */
async function layers(page: Page) {
  // CDP's replies, loosely typed (a diagnosis)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Reply = any;
  type L = { width: number; height: number; drawsContent: boolean };
  const cdp = (await page.context().newCDPSession(page)) as unknown as { send: (m: string, x?: unknown) => Promise<Reply>; on: (e: string, f: (x: Reply) => void) => void; detach: () => Promise<void> };
  let list: L[] = [];
  cdp.on("LayerTree.layerTreeDidChange", (e: { layers?: L[] }) => {
    if (e.layers) list = e.layers;
  });
  await cdp.send("LayerTree.enable");
  await page.evaluate(() => document.body.style.setProperty("--im-diag", String(Math.random())));
  await page.waitForTimeout(1500);
  const drawing = list.filter((l) => l.drawsContent);
  await cdp.send("LayerTree.disable");
  await cdp.detach();
  return { drawingLayers: drawing.length, drawingMegapixels: +(drawing.reduce((s, l) => s + l.width * l.height, 0) / 1e6).toFixed(1) };
}

const click = (page: Page, side: Side) => page.getByTestId(`button-toggle-${side}`).click();

test("S5A-08: hiding, showing and a resize on release to the screen on “Performance test”, at 30 % and at 100 % dense", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(30 * 60_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  await open(page, { x: 0, y: 0, zoom: 1 });
  const pane = await page.locator(".react-flow__pane").evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
  const data = generate();
  const ent23 = data.cards.find((c) => c.id === "ent:23")!, src57 = data.cards.find((c) => c.id === "src:57")!;
  const views = {
    "30 % around ent:23": { x: pane.w / 2 - (ent23.x + ent23.w / 2) * 0.3, y: pane.h / 2 - (ent23.y + 200) * 0.3, zoom: 0.3 },
    "100 % dense": { x: 768 - src57.x, y: 300 - src57.y, zoom: 1 },
  };
  const results: Record<string, Record<string, unknown>> = {};
  for (const [name, view] of Object.entries(views)) {
    results[name] = {};
    const r = results[name]!;
    await open(page, view);
    r.layers = { shown: await layers(page) };
    await click(page, "left");
    (r.layers as Record<string, unknown>).leftHidden = await layers(page);
    await click(page, "right");
    (r.layers as Record<string, unknown>).bothHidden = await layers(page);
    await click(page, "left");
    await click(page, "right");
    // the guide line showing: a grip held down after a move (in the page)
    await page.evaluate(() => {
      const g = document.querySelector<HTMLElement>('[data-testid="grip-left"]')!, b = g.getBoundingClientRect();
      const fire = (type: string, x: number) => g.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: "mouse", button: 0, buttons: 1, clientX: x, clientY: b.y + 300, isPrimary: true }));
      fire("pointerdown", b.x + 4);
      fire("pointermove", b.x + 104);
    });
    (r.layers as Record<string, unknown>).guideShowing = await layers(page);
    await page.evaluate(() => {
      const g = document.querySelector<HTMLElement>('[data-testid="grip-left"]')!, b = g.getBoundingClientRect();
      g.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 7, pointerType: "mouse", button: 0, buttons: 0, clientX: b.x + 4, clientY: b.y + 300, isPrimary: true }));
    });
    // the release applies the guide's last place; Home puts the default back for the timed loops
    await expect.poll(async () => Math.round((await page.getByTestId("panel-left").boundingBox())!.width)).toBe(364);
    await page.getByTestId("grip-left").focus();
    await page.keyboard.press("Home");
    await expect.poll(async () => Math.round((await page.getByTestId("panel-left").boundingBox())!.width)).toBe(264);

    for (const side of ["left", "right"] as const) {
      await open(page, view);
      const toggled = await tracedSwitches(page, `S5A-08 ${name} ${side} hide-show`, () => toggleLoop(page, side, SETTLED_PAIRS));
      expect(toggled, `${name} ${side} hide/show`).not.toHaveProperty("error");
      r[`${side}: hide (on) / show (off)`] = toggled;
      await open(page, view);
      const resized = await tracedSwitches(page, `S5A-08 ${name} ${side} resize`, () => resizeLoop(page, side, SETTLED_PAIRS));
      expect(resized, `${name} ${side} resize`).not.toHaveProperty("error");
      r[`${side}: resize release, +100 (on) / −100 (off)`] = resized;
    }
  }
  saveResults("S5A-08", { measured: MEASURE, browser: browser.version(), pane, views: results });
});
