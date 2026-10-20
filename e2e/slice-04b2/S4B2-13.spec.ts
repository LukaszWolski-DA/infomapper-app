// S4B2-13 (slice 4b-2, section 6; measurement build only, `npm run measure:canvas -- --to-screen --only s4b2drag`):
// dragging a requirement card against dragging an entity card (the baseline), on “Performance test – requirements”, at
// 100 % (each view centred on the card dragged: REQ-102's card, ent:4) and at 30 % around ent:23 (both in it). Each drag
// by the header, in circles, for 6 s (S2A-14's path, driven in the page), recorded per rAF and, with TO_SCREEN=1, traced as presented
// frames (both drags in every round, answer after step 1). Bar: the requirement drag's median within the entity drag's
// spread over the rounds, or above it. Results in test-results/S4B2-13.json.

import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { tracedPan } from "../measure/switches";
import { TO_SCREEN } from "../measure/trace";
import { MEASURE, MEASURE_USE, saveResults, startRecording, stopRecording } from "../slice-01b/measure";
import { expect, test, type Page } from "./fixtures";
import { signInAs, store } from "./helpers";
import { aroundEnt23, centredOn, entityId, openReq, paneSize, REQ_CANVAS, requirementId } from "./measure";

test.use(MEASURE_USE);
const DRAG_MS = MEASURE ? 6000 : 1500;

/**
 * Drags the element under `grab` in circles for DRAG_MS, recording every frame: in the page, one pointer and mouse move
 * per frame, as the pan driver dispatches its wheel events (step 8: Playwright's mouse, one CDP round trip per move, left
 * the display compositor drawing about 2 frames a second while the page ran its frames, so its presented frames meant
 * nothing).
 */
async function circles(page: Page, grab: { x: number; y: number }) {
  await startRecording(page);
  await page.evaluate(
    ([grab, ms]) =>
      new Promise<void>((done) => {
        const target = document.elementFromPoint(grab.x, grab.y)!;
        const init = (x: number, y: number, buttons: number) => ({ bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons, pointerId: 1, pointerType: "mouse", isPrimary: true, view: window });
        target.dispatchEvent(new PointerEvent("pointerdown", init(grab.x, grab.y, 1)));
        target.dispatchEvent(new MouseEvent("mousedown", init(grab.x, grab.y, 1)));
        const t0 = performance.now();
        let x = grab.x, y = grab.y;
        const step = (now: number) => {
          const a = ((now - t0) / 1000) * 3;
          x = grab.x + 80 * Math.sin(a) + 80 * (1 - Math.cos(Math.min(a, Math.PI)) / 2);
          y = grab.y + 60 * Math.cos(a) - 60;
          const el = document.elementFromPoint(x, y) ?? document.body;
          el.dispatchEvent(new PointerEvent("pointermove", init(x, y, 1)));
          el.dispatchEvent(new MouseEvent("mousemove", init(x, y, 1)));
          if (now - t0 < ms) return requestAnimationFrame(step);
          el.dispatchEvent(new PointerEvent("pointerup", init(x, y, 0)));
          el.dispatchEvent(new MouseEvent("mouseup", init(x, y, 0)));
          done();
        };
        requestAnimationFrame(step);
      }),
    [grab, DRAG_MS] as const,
  );
  return stopRecording(page);
}

const headPoint = async (page: Page, selector: string) => {
  const b = (await page.locator(selector).first().boundingBox())!;
  return { x: b.x + Math.min(30, b.width / 4), y: b.y + b.height / 2 };
};

test("S4B2-13: dragging a requirement card against dragging an entity card, presented frames, 100 % and 30 %", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(20 * 60_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  await openReq(page, { x: 0, y: 0, zoom: 1 });
  const pane = await paneSize(page);
  const r102 = (await store().canvasItems.listOfCanvas(LARGE_IDS.workspace, REQ_CANVAS)).find((i) => i.requirement_id === requirementId("REQ-102"))!;
  const ent4 = generate().cards.find((c) => c.id === "ent:4")!;
  const reqHead = '[data-testid="card-requirement"][data-key="REQ-102"] .rh';
  const ent4Card = (await store().canvasItems.listOfCanvas(LARGE_IDS.workspace, REQ_CANVAS)).find((i) => i.entity_id === entityId("ent:4"))!;
  const entHead = `.react-flow__node[data-id="${ent4Card.id}"] .c-head`;
  const cases = {
    "requirement card, 100 %": { view: centredOn(pane, r102.x + 115, r102.y + 55, 1), head: reqHead },
    "entity card, 100 %": { view: centredOn(pane, ent4.x + ent4.w / 2, ent4.y + 100, 1), head: entHead },
    "requirement card, 30 %": { view: aroundEnt23(pane, 0.3), head: reqHead },
    "entity card, 30 %": { view: aroundEnt23(pane, 0.3), head: entHead },
  };
  const results: Record<string, unknown> = {};
  for (const [name, c] of Object.entries(cases)) {
    await openReq(page, c.view);
    const before = (await page.locator(c.head).first().boundingBox())!;
    const raf = await circles(page, await headPoint(page, c.head));
    // the driver really drags: the card is somewhere else afterwards
    await expect.poll(async () => Math.hypot((await page.locator(c.head).first().boundingBox())!.x - before.x, (await page.locator(c.head).first().boundingBox())!.y - before.y), `${name}: moved`).toBeGreaterThan(20);
    let presented: unknown = null;
    if (TO_SCREEN) {
      await openReq(page, c.view);
      const grab = await headPoint(page, c.head);
      presented = (await tracedPan(page, `S4B2-13 ${name}`, () => circles(page, grab))).presented;
    }
    results[name] = { raf, presented };
  }
  saveResults("S4B2-13", { measured: MEASURE, toScreen: TO_SCREEN, browser: browser.version(), pane, drags: results });
});
