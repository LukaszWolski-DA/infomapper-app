// Screenshots for S4P-04 (slice 4p): the app beside the prototype, on “Customer & orders”, for Łukasz to judge. Not a
// check: it only writes PNGs to docs/prd/slice-04p-screens/<SCREENS>/. Runs only when asked (the normal run leaves it
// out), e.g. on trial A's branch:
//
//   SCREENS=step-1-trial-a npx playwright test e2e/slice-04p/S4P-04-screens.spec.ts
//
// Step 1 (trial A): the hover at 100 % (on the row Customer.email) and at 30 % (below 40 % the app draws no rows, so on
// the mapping line customers.email_addr → Customer.email), frames expanded.
// Step 2, where the branch has them (each part skips itself otherwise): the hover with the hover line fade (trial A's
// variant, "plain"); fading: Focus and the small, large and dense lenses on “Performance test” at 100 % and 30 %, and
// their equivalents on “Customer & orders” beside the prototype (Focus on Customer; REQ-102, attributes; REQ-101, the
// entity). The prototype has no requirement linked to tables only, so the dense lens has no prototype picture.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { generate } from "../../src/data/local/large-generator";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { seedId } from "../../src/data/local/seed-model";
import { E2E_DB } from "../config";
import { expect, test, type Page } from "../slice-04a/fixtures";
import { canvasUrl, ids, mappingId, openCanvas, requirementByKey, rowNamed, signInAs } from "../slice-04a/helpers";

const OUT = path.resolve("docs", "prd", "slice-04p-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));
const PROTOTYPE = pathToFileURL(path.resolve("docs", "prototype", "infomapper-model-prototype.html")).href;
const VIEWS = { "100": { x: 0, y: 0, zoom: 1 }, "30": { x: 40, y: 40, zoom: 0.3 } } as const;

test.use({ viewport: { width: 1536, height: 864 } });

/** The middle of a path on the screen. */
const middleOf = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const p = el as SVGPathElement;
    const pt = p.getPointAtLength(p.getTotalLength() / 2);
    const m = p.getScreenCTM()!;
    return { x: pt.x * m.a + pt.y * m.c + m.e, y: pt.x * m.b + pt.y * m.d + m.f };
  });

async function prototypeAt(page: Page, view: { x: number; y: number; zoom: number }) {
  await page.goto(PROTOTYPE);
  await page.waitForTimeout(800);
  // it may open on its workspace home: open “Customer & orders” as its own home page's tile would
  await page.evaluate(() => (0, eval)("openCanvasFromHome")("dia_main"));
  await page.waitForTimeout(300);
  await page.evaluate((v) => {
    const V = (0, eval)("V") as { zoom: number; px: number; py: number };
    V.zoom = v.zoom;
    V.px = v.x;
    V.py = v.y;
    (0, eval)("applyT")();
  }, view);
  await page.waitForTimeout(300);
}

test("S4P-04 screenshots: the hover at 100 % and 30 %, app and prototype", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const shot = (name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
  await signInAs(page, "Łukasz");
  const map = await mappingId("customers.email_addr", "Customer.email");

  // the app at 100 %: the row Customer.email
  await openCanvas(page, canvasUrl(), VIEWS["100"]);
  const row = (await rowNamed(page, "Customer", "email").boundingBox())!;
  await page.mouse.move(row.x + 40, row.y + row.height / 2);
  await expect(page.getByTestId("hover-row")).toHaveCount(3);
  await shot("hover-100-app");
  // the app at 30 %: the line customers.email_addr → Customer.email
  await page.mouse.move(5, 5);
  await openCanvas(page, canvasUrl(), VIEWS["30"]);
  const mid = await middleOf(page, `[data-testid="line-mapping"][data-mapping="${map}"] path.s`);
  await page.mouse.move(mid.x, mid.y);
  await expect(page.getByTestId("layer-hover-lines")).toHaveCount(1);
  await shot("hover-30-app");

  // the prototype, same views (its own demo model, the same cards)
  await prototypeAt(page, VIEWS["100"]);
  const protoRow = page.locator('.card[data-id="lent_customer"] .row', { hasText: /^\s*email/ }).first();
  const pr = (await protoRow.boundingBox())!;
  await page.mouse.move(pr.x + 40, pr.y + pr.height / 2);
  await page.waitForTimeout(300);
  await shot("hover-100-prototype");
  await prototypeAt(page, VIEWS["30"]);
  const protoMap = await page.evaluate(() => {
    const S = (0, eval)("S") as { mappings: { id: string; columnId: string; attributeId: string }[] };
    return S.mappings.find((m) => m.columnId === "src_customers__email_addr" && m.attributeId === "latr_customer_email")?.id ?? null;
  });
  expect(protoMap).not.toBeNull();
  const pm = await middleOf(page, `g.lnk[data-t="map"][data-id="${protoMap}"] path.s`);
  await page.mouse.move(pm.x, pm.y);
  await page.waitForTimeout(300);
  await shot("hover-30-prototype");
});

/** The hover at 100 % and 30 % with the hover line fade (trial A's variant), where the branch has it. */
test("S4P-04 screenshots: the hover with the hover line fade, 100 % and 30 %", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const shot = (name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEWS["100"]);
  test.skip(!(await page.evaluate(() => typeof (window as unknown as { __imHoverFade?: unknown }).__imHoverFade === "function")), "no hover line fade on this branch");
  const map = await mappingId("customers.email_addr", "Customer.email");
  await page.evaluate(() => (window as unknown as { __imHoverFade: (m: string) => void }).__imHoverFade("plain"));
  const row = (await rowNamed(page, "Customer", "email").boundingBox())!;
  await page.mouse.move(row.x + 40, row.y + row.height / 2);
  await expect(page.getByTestId("hover-veil")).toHaveCount(1);
  await shot("hover-fade-100-app");
  await page.mouse.move(5, 5);
  await openCanvas(page, canvasUrl(), VIEWS["30"]);
  await page.evaluate(() => (window as unknown as { __imHoverFade: (m: string) => void }).__imHoverFade("plain"));
  const mid = await middleOf(page, `[data-testid="line-mapping"][data-mapping="${map}"] path.s`);
  await page.mouse.move(mid.x, mid.y);
  await expect(page.getByTestId("hover-veil")).toHaveCount(1);
  await shot("hover-fade-30-app");
});

/** Switches fading through the measuring hook and waits until it is drawn. */
async function fadeOn(page: Page, request: unknown) {
  await page.evaluate((r) => (window as unknown as { __imFade: (r: unknown) => void }).__imFade(r), request);
  await expect(page.getByTestId("layer-fade")).toHaveCount(1);
  await page.waitForTimeout(300);
}

/** The prototype with Focus on an entity or a requirement selected (its lens), at a view. */
async function prototypeFading(page: Page, view: { x: number; y: number; zoom: number }, sel: { focus: string } | { req: string }) {
  await prototypeAt(page, view);
  await page.evaluate((sel) => {
    const V = (0, eval)("V") as { sel: unknown; focus: boolean };
    if ("focus" in sel) {
      V.sel = { t: "entity", id: sel.focus };
      V.focus = true;
    } else {
      const S = (0, eval)("S") as { requirements: { id: string; key: string }[] };
      V.sel = { t: "req", id: S.requirements.find((r) => r.key === sel.req)!.id };
    }
    (0, eval)("rebuild")();
  }, sel);
  await page.waitForTimeout(400);
}

test("S4P-04 screenshots: Focus and the lenses at 100 % and 30 %, app (Performance test and Customer & orders) and prototype", async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(OUT, { recursive: true });
  const shot = (name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
  const { entity } = await ids();
  const req101 = await requirementByKey("REQ-101"), req102 = await requirementByKey("REQ-102");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEWS["100"]);
  await page.evaluate((r) => (window as unknown as { __imFade?: (r: unknown) => void }).__imFade?.(r), { focus: entity("Customer").id });
  const mechanism = await page.getByTestId("layer-fade").waitFor({ timeout: 3000 }).then(() => true, () => false);
  test.skip(!mechanism, "no fading mechanism on this branch");

  // Customer & orders, app and prototype
  const demo = [
    ["focus", { focus: entity("Customer").id }, { focus: "lent_customer" }],
    // slice 4b-1: the lens is gone; Focus on the requirement (the prototype's lens is its nearest picture)
    ["lens-small", { focus: { t: "requirement", id: req102.id } }, { req: "REQ-102" }],
    ["lens-large", { focus: { t: "requirement", id: req101.id } }, { req: "REQ-101" }],
  ] as const;
  for (const [name, app, proto] of demo) {
    for (const [zoom, view] of Object.entries(VIEWS)) {
      await openCanvas(page, canvasUrl(), view);
      await fadeOn(page, app);
      await shot(`demo-${name}-${zoom}-app`);
      await prototypeFading(page, view, proto);
      await shot(`demo-${name}-${zoom}-prototype`);
    }
  }

  // Performance test: the fading spec's scenarios and views
  await seedLargeData(E2E_DB);
  const WS = LARGE_IDS.workspace;
  const cards = generate().cards;
  const ent23 = cards.find((c) => c.id === "ent:23")!, src57 = cards.find((c) => c.id === "src:57")!;
  const largeUrl = canvasUrl(LARGE_IDS.canvas, LARGE_IDS.project, LARGE_IDS.workspace);
  await openCanvas(page, largeUrl, { x: 0, y: 0, zoom: 1 });
  const pane = await page.locator(".react-flow__pane").evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
  const around = (cx: number, cy: number, zoom: number) => ({ x: pane.w / 2 - cx * zoom, y: pane.h / 2 - cy * zoom, zoom });
  const perf = [
    ["focus", { focus: seedId(WS, "entity:ent:23") }, ent23.x + 128, ent23.y + 200],
    ["lens-small", { focus: { t: "requirement", id: seedId(WS, "requirement:REQ-101") } }, ent23.x + 128, ent23.y + 200],
    ["lens-large", { focus: { t: "requirement", id: seedId(WS, "requirement:REQ-102") } }, ent23.x + 128, ent23.y + 200],
    ["lens-dense", { focus: { t: "requirement", id: seedId(WS, "requirement:REQ-103") } }, src57.x + 128, src57.y + 300],
  ] as const;
  for (const [name, request, cx, cy] of perf) {
    for (const zoom of [1, 0.3]) {
      // the dense lens at 100 %: S1A-14's own view around src:57
      const view = name === "lens-dense" && zoom === 1 ? { x: 768 - src57.x, y: 300 - src57.y, zoom: 1 } : around(cx, cy, zoom);
      await openCanvas(page, largeUrl, view);
      await fadeOn(page, request);
      await shot(`perf-${name}-${zoom === 1 ? 100 : 30}-app`);
    }
  }
});
