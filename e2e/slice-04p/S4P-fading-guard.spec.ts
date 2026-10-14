// Slice 4p, step 2: guards for a fading candidate (the branch's `FadeLayer`), on the e2e dev server where the canvas,
// the Overview's miniature and the fading layer count their commits. Skipped where the page has no fading mechanism
// (the slice branch before step 3, trial A). Checks on “Customer & orders”:
//   - switching Focus and a lens on and off re-renders neither the canvas nor the miniature (S4P-12);
//   - what is lit: Focus on Customer lights its card and the cards it is related to; REQ-101's lens tints Customer's
//     rows covered (5) and gap (3), the seed's coverage;
//   - panning and zooming with fading on re-render neither the canvas nor the fading layer (no script per frame);
//   - F4: the veil's holes follow a lit card that is dragged and one whose width is dragged; F1: the lit card's wrapper
//     is lifted above the veil.
// Becomes part of S4P-12's test for the chosen mechanism at step 5.

import { expect, test, type Page } from "../slice-04a/fixtures";
import { box, canvasUrl, card, ids, openCanvas, paneMiddle, requirementByKey, signInAs, WHOLE } from "../slice-04a/helpers";

const counters = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __imCanvasCommits?: number; __imMiniatureCommits?: number; __imFadeCommits?: number };
    return { canvas: w.__imCanvasCommits ?? 0, miniature: w.__imMiniatureCommits ?? 0, fade: w.__imFadeCommits ?? 0 };
  });
const fade = (page: Page, request: unknown) => page.evaluate((r) => (window as unknown as { __imFade: (r: unknown) => void }).__imFade(r), request);
/** The lit card's position as React Flow draws it. */
const cardAt = (page: Page, name: string) =>
  card(page, name).evaluate((el) => {
    const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec((el as HTMLElement).style.transform)!;
    return { x: Number(m[1]), y: Number(m[2]), w: (el as HTMLElement).offsetWidth };
  });

test("S4P fading (guard): switching re-renders neither the canvas nor the miniature; Focus and a lens light the right cards and rows; panning and zooming run no fading script; holes follow a dragged and a resized card", async ({ page }) => {
  const { entity } = await ids();
  const customer = entity("Customer");
  const req101 = await requirementByKey("REQ-101");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  await page.waitForTimeout(1500);
  const before = await counters(page);
  expect(before.canvas).toBeGreaterThan(0);

  // a mechanism on this branch?
  await fade(page, { focus: customer.id });
  const layer = page.getByTestId("layer-fade");
  if (!(await layer.waitFor({ timeout: 3000 }).then(() => true, () => false))) {
    await fade(page, null);
    test.skip(true, "no fading mechanism on this branch");
  }
  await expect(layer).toHaveAttribute("data-fade", `focus:${customer.id}`);
  // Customer, the two tables that feed it and Sales Order (places)
  expect(Number(await layer.getAttribute("data-lit-cards"))).toBeGreaterThanOrEqual(3);
  await fade(page, null);
  await expect(layer).toHaveCount(0);

  // REQ-101 (Customer): its 8 attributes tinted, 5 covered and 3 gaps (slice 4a's coverage)
  await fade(page, { lens: req101.id });
  await expect(layer).toHaveAttribute("data-fade", `lens:${req101.id}`);
  await expect(page.getByTestId("lit-row-covered")).toHaveCount(5);
  await expect(page.getByTestId("lit-row-gap")).toHaveCount(3);
  await fade(page, null);
  await expect(layer).toHaveCount(0);
  const afterSwitching = await counters(page);
  expect({ canvas: afterSwitching.canvas, miniature: afterSwitching.miniature }, "canvas and miniature commits after switching").toEqual({ canvas: before.canvas, miniature: before.miniature });

  // pan and zoom with Focus on: no canvas and no fading commit
  await fade(page, { focus: customer.id });
  await expect(layer).toHaveCount(1);
  await page.waitForTimeout(500);
  const on = await counters(page);
  const mid = await paneMiddle(page);
  await page.mouse.move(mid.x, mid.y);
  for (let i = 0; i < 10; i++) await page.mouse.wheel(20, 10);
  await page.keyboard.down("Control");
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -20);
  await page.keyboard.up("Control");
  await page.waitForTimeout(500);
  expect(await counters(page), "commits while panning and zooming with fading on").toEqual(on);

  // the lit card follows: F4's hole, F1's lifted wrapper
  await openCanvas(page, canvasUrl(), WHOLE);
  await fade(page, { focus: customer.id });
  await expect(layer).toHaveCount(1);
  const isF4 = (await layer.evaluate((el) => el.tagName.toLowerCase())) === "svg";
  const hole = async () => {
    const p = await cardAt(page, "Customer");
    return isF4 ? `M${+(p.x + 10).toFixed(1)},${+p.y.toFixed(1)}H${+(p.x + p.w - 10).toFixed(1)}` : `zIndex=2`;
  };
  const shows = async () =>
    isF4 ? (await layer.locator("path").getAttribute("d"))!.includes(await hole()) : (await card(page, "Customer").evaluate((el) => (el as HTMLElement).style.zIndex)) === "2";
  await expect.poll(shows).toBe(true);
  // drag Customer by its header
  const head = await box(card(page, "Customer").locator(".c-head .c-l2"));
  await page.mouse.move(head.x + 20, head.y + head.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(head.x + 20 + i * 10, head.y + head.height / 2 + i * 5);
  await page.mouse.up();
  await expect.poll(shows, "the lit card is shown after a drag").toBe(true);
  // drag its width
  const handle = await box(card(page, "Customer").getByTestId("handle-card-width"));
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 40);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(handle.x + handle.width / 2 + i * 10, handle.y + 40);
  await page.mouse.up();
  await expect.poll(shows, "the lit card is shown after a resize").toBe(true);
  await fade(page, null);
});
