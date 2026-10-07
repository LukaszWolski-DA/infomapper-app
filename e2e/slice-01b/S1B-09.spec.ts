// S1B-09: card width (D-37) by dragging the edge and by “Fit width to names”, saved per canvas; and C-09 on
// “Performance test”. The normal run checks the behaviour and runs the resize steps without judging the speed; the
// measurement runs with MEASURE=1 (see measure.ts) and records the frame rate while the 200-row card's edge is dragged
// back and forth for 6 s, against the bar of 45 fps on average:
//
//   MEASURE=1 npx playwright test e2e/slice-01b/S1B-09.spec.ts
//
// Results go to test-results/S1B-09.json. C-09 is partly met on the development laptop (slice 1b decision); the
// production-build measurement is in the Supabase slice (docs/known-limitations.md).

import { seedLargeData } from "../../src/data/local/dev-data";
import { E2E_DB } from "../config";
import { expect, test } from "./fixtures";
import { box, canvasUrl, card, expectToast, ids, LEFT_AT_100, loadItems, openCanvas, SEED_IDS, signInAs, toolboxAt } from "./helpers";
import { DIAG, MEASURE, MEASURE_USE, openLarge, saveResults, startRecording, stopRecording } from "./measure";

if (MEASURE) test.use(MEASURE_USE);

test("S1B-09: card width changes by dragging the edge and by “Fit width to names”; persists per canvas. On “Performance test”, resize runs at 45 fps or better on average (C-09)", async ({ page, browser }) => {
  test.setTimeout(MEASURE ? 300_000 : 120_000);
  const { entity } = await ids();
  await signInAs(page, "Łukasz");
  // Customer's right edge in view, with room to its right
  await openCanvas(page, canvasUrl(), { x: -300, y: 0, zoom: 1 });
  const customer = card(page, "Customer").locator("[data-card]");
  const customerCard = (await customer.getAttribute("data-card"))!;
  expect((await box(customer)).width).toBeCloseTo(256, 0);

  // drag the right edge 100 px: an outline while dragging, the card takes the width on release (snapped to 8 px)
  const handle = await box(card(page, "Customer").getByTestId("handle-card-width"));
  const from = { x: handle.x + handle.width / 2, y: handle.y + 60 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(from.x + i * 10, from.y);
  await expect(page.getByTestId("outline-card-width")).toHaveCount(1);
  expect((await box(customer)).width).toBeCloseTo(256, 0);
  await page.mouse.up();
  await expect(page.getByTestId("outline-card-width")).toHaveCount(0);
  await expect.poll(async () => (await box(customer)).width).toBeCloseTo(360, 0);
  /** The saved width of a card (null is the default, 256 px). */
  const savedWidth = async (id: string, canvasId?: string) => (await loadItems(undefined, canvasId)).find((i) => i.id === id)!.width ?? 256;
  await expect.poll(() => savedWidth(customerCard)).toBe(360);

  // double-click on the edge fits the width to the names (the default width here)
  await card(page, "Customer").getByTestId("handle-card-width").dblclick();
  await expectToast(page, "Fitted the card to its names.");
  await expect.poll(() => savedWidth(customerCard)).toBeLessThan(360);
  const fitted = await savedWidth(customerCard);
  await expect.poll(async () => (await box(customer)).width).toBeCloseTo(fitted, 0);

  // “Fit width to names” in the toolbox, on a card with a long name: Order Line exists on both canvases
  const line = entity("Order Line");
  await page.mouse.move(0, 0);
  await openCanvas(page, canvasUrl(), { x: -640, y: -480, zoom: 1 });
  const head = await box(card(page, "Order Line").locator(".c-head"));
  // make it wide first, then fit
  const lineHandle = await box(card(page, "Order Line").getByTestId("handle-card-width"));
  await page.mouse.move(lineHandle.x + lineHandle.width / 2, lineHandle.y + 40);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(lineHandle.x + lineHandle.width / 2 + i * 20, lineHandle.y + 40);
  await page.mouse.up();
  const lineCard = (await loadItems()).find((i) => i.entity_id === line.id)!.id;
  await expect.poll(() => savedWidth(lineCard)).toBe(456);
  expect(await toolboxAt(page, { x: head.x + 20, y: head.y + 10 })).toContain("Fit width to names");
  await page.getByTestId("menu-toolbox").getByRole("menuitem", { name: "Fit width to names" }).click();
  await expectToast(page, "Fitted the card to its names.");
  await expect.poll(() => savedWidth(lineCard)).toBeLessThan(456);
  const lineFitted = await savedWidth(lineCard);

  // per canvas: widen it again here; on “Order lines & products” Order Line keeps its own width
  await page.mouse.move(lineHandle.x + lineHandle.width / 2, lineHandle.y + 40);
  await page.mouse.down();
  const fittedHandle = await box(card(page, "Order Line").getByTestId("handle-card-width"));
  await page.mouse.move(fittedHandle.x + fittedHandle.width / 2, fittedHandle.y + 40);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(fittedHandle.x + fittedHandle.width / 2 + i * 16, fittedHandle.y + 40);
  await page.mouse.up();
  await expect.poll(() => savedWidth(lineCard)).toBe(lineFitted + 80);
  const other = (await loadItems(undefined, SEED_IDS.canvasOrderLines)).find((i) => i.entity_id === line.id)!;
  expect(other.width).toBeNull();
  await openCanvas(page, canvasUrl(SEED_IDS.canvasOrderLines, SEED_IDS.projOrderManagement), LEFT_AT_100);
  expect((await box(card(page, "Order Line").locator("[data-card]"))).width).toBeCloseTo(256, 0);
  await page.reload();
  await openCanvas(page, canvasUrl(), { x: -640, y: -480, zoom: 1 });
  expect((await box(card(page, "Order Line").locator("[data-card]"))).width).toBeCloseTo(lineFitted + 80, 0);

  // ---- C-09 on “Performance test”: the 200-row card's edge, at 50 % like the spike ----
  await seedLargeData(E2E_DB);
  await openLarge(page, { x: 0, y: 0, zoom: 0.5 });
  const big = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>(".react-flow__node")];
    // the tallest card (also when slice 2a's DIAG=blocks draws it as a block without rows)
    const n = nodes.sort((a, b) => b.offsetHeight - a.offsetHeight)[0]!;
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(n.style.transform)!;
    return { id: n.dataset.id!, x: +m[1]!, y: +m[2]!, w: n.offsetWidth, rows: n.querySelectorAll(".row[data-row]").length };
  });
  if (DIAG !== "blocks") expect(big.rows).toBe(200);
  const size = page.viewportSize()!;
  await openLarge(page, { x: size.width / 2 - (big.x + big.w / 2) * 0.5, y: 120 - big.y * 0.5, zoom: 0.5 });
  const edge = await box(page.locator(`.react-flow__node[data-id="${big.id}"] [data-testid="handle-card-width"]`));
  const at = { x: edge.x + edge.width / 2, y: edge.y + 300 };
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await startRecording(page);
  const t0 = Date.now();
  let a = 0;
  while (Date.now() - t0 < (MEASURE ? 6000 : 1500)) {
    a += 0.05;
    await page.mouse.move(at.x + 90 * Math.sin(a) + 60, at.y);
  }
  const resize = await stopRecording(page);
  await page.mouse.up();
  const results = { measured: MEASURE, browser: browser.version(), viewport: page.viewportSize(), card: { rows: big.rows }, "C-09 resize": resize };
  saveResults("S1B-09", results);
  await test.info().attach("S1B-09 results", { body: JSON.stringify(results, null, 2), contentType: "application/json" });
  if (MEASURE) expect.soft(resize.avgFps, "C-09: resize, average fps (bar 45)").toBeGreaterThanOrEqual(45);
});
