// S4B1-07 (slice 4b-1, step 3: F4): the veil's holes follow what is lit. On “Customer & orders”, through the test hook
// (Focus has no UI until step 7):
//   - Focus on Customer cuts a hole at each lit card; dragging Customer and resizing it move and widen its hole;
//   - with Customer in a collapsed frame, its frame's block is lit and holed instead;
//   - a note pinned to a lit card is holed (stays lit); notes pinned to a faded card and free notes are not (fade);
//   - below 40 % (cards drawn as header and block) the holes still lie on the cards;
//   - the veil's edge never shows while any of the content is in view (T1, step 8: the veil reaches one pane at the
//     minimum zoom beyond the content): at 10 %, each corner of the content at the opposite corner of the pane.

import { expect, test, type Page } from "./fixtures";
import { AROUND, box, canvasUrl, card, collapse, fade, fadeTables, holeAt, ids, makeFrame, nodeRect, openCanvas, signInAs, veilHoles, WHOLE } from "./helpers";

const holed = async (page: Page, name: string) => holeAt(await veilHoles(page), await nodeRect(card(page, name)));

test("S4B1-07: the veil's holes follow a drag, a resize and a collapsed frame; notes pinned to a lit card stay lit, others fade; holes lie on the cards below 40 %", async ({ page }) => {
  const { entity, model } = await ids();
  const customer = entity("Customer");
  const orderLine = model.sourceTables.find((t) => t.name === "order_line")!;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  await page.waitForTimeout(1000);
  const layer = page.getByTestId("layer-fade");

  // Focus on Customer: a hole at each of its 4 lit cards
  await fade(page, { focus: customer.id });
  await expect(layer).toHaveAttribute("data-fade", `focus:${customer.id}`);
  for (const name of ["Customer", "Sales Order"]) expect(await holed(page, name), name).toBe(true);
  expect(await veilHoles(page)).toHaveLength(4);
  // notes pinned to order_line (faded here) and the free note get no hole
  expect(Number(await layer.getAttribute("data-lit-notes"))).toBe(0);

  // a drag by the header: the hole moves with the card
  const before = await nodeRect(card(page, "Customer"));
  const head = await box(card(page, "Customer").locator(".c-head .c-l2"));
  await page.mouse.move(head.x + 20, head.y + head.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(head.x + 20 + i * 12, head.y + head.height / 2 + i * 6);
  await page.mouse.up();
  await expect.poll(async () => (await nodeRect(card(page, "Customer"))).x).not.toBe(before.x);
  await expect.poll(() => holed(page, "Customer"), "the hole after the drag").toBe(true);

  // a resize: the hole widens with the card
  const width = (await nodeRect(card(page, "Customer"))).w;
  const handle = await box(card(page, "Customer").getByTestId("handle-card-width"));
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 40);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(handle.x + handle.width / 2 + i * 10, handle.y + 40);
  await page.mouse.up();
  await expect.poll(async () => (await nodeRect(card(page, "Customer"))).w).toBeGreaterThan(width);
  await expect.poll(() => holed(page, "Customer"), "the hole after the resize").toBe(true);
  await fade(page, null);
  await expect(layer).toHaveCount(0);

  // notes: a lit order_line holes the two notes pinned to it, not the free note
  await fadeTables(page, [orderLine.id], "order_line");
  expect(await holed(page, "order_line")).toBe(true);
  expect(Number(await layer.getAttribute("data-lit-notes"))).toBe(2);
  const notes = page.getByTestId("note");
  const pinned = await notes.evaluateAll((els) => els.filter((el) => el.textContent?.includes("order_line")).length);
  expect(pinned, "the seed's notes pinned to order_line").toBe(2);
  expect(await veilHoles(page)).toHaveLength(3);
  await fade(page, null);

  // below 40 %: the cards drawn as header and block, the holes still on them
  await openCanvas(page, canvasUrl(), { x: 10, y: 10, zoom: 0.3 });
  await page.waitForTimeout(1000);
  await fade(page, { focus: customer.id });
  await expect(layer).toHaveCount(1);
  for (const name of ["Customer", "Sales Order"]) await expect.poll(() => holed(page, name), `${name} at 30 %`).toBe(true);
  await fade(page, null);
});

test("S4B1-07: with Customer in a collapsed frame, the frame's block is lit and holed", async ({ page }) => {
  const { entity } = await ids();
  const customer = entity("Customer");
  const frameId = await makeFrame(AROUND.customer, { name: "Around Customer" });
  await collapse(frameId);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  await page.waitForTimeout(1000);
  await fade(page, { focus: customer.id });
  const layer = page.getByTestId("layer-fade");
  await expect(layer).toHaveAttribute("data-fade", `focus:${customer.id}`);
  const block = page.locator(`.react-flow__node[data-id="block:${frameId}"]`);
  await expect(block).toHaveCount(1);
  await expect.poll(async () => holeAt(await veilHoles(page), await nodeRect(block)), "a hole at the collapsed frame's block").toBe(true);
  expect(await card(page, "Customer").count(), "Customer's card hidden in its block").toBe(0);
  await fade(page, null);
});

/** The view and the content in canvas coordinates, read from the page: the viewport's transform and every node's and note's box. */
const viewAndContent = (page: Page) =>
  page.evaluate(() => {
    const pane = document.querySelector(".react-flow__pane")!.getBoundingClientRect();
    const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec((document.querySelector(".react-flow__viewport") as HTMLElement).style.transform)!;
    const [tx, ty, z] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const toCanvas = (sx: number, sy: number) => ({ x: (sx - pane.left - tx) / z, y: (sy - pane.top - ty) / z });
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const el of document.querySelectorAll<HTMLElement>('.react-flow__node, [data-testid="note"]')) {
      const b = el.getBoundingClientRect();
      if (!b.width && !b.height) continue;
      const a = toCanvas(b.left, b.top), c = toCanvas(b.right, b.bottom);
      x0 = Math.min(x0, a.x); y0 = Math.min(y0, a.y); x1 = Math.max(x1, c.x); y1 = Math.max(y1, c.y);
    }
    const v0 = toCanvas(pane.left, pane.top), v1 = toCanvas(pane.right, pane.bottom);
    return { zoom: z, pane: { w: pane.width, h: pane.height }, view: { x0: v0.x, y0: v0.y, x1: v1.x, y1: v1.y }, content: { x0, y0, x1, y1 } };
  });

/** The veil's outer rectangle, from the first sub-path of its path (`M x0,y0 H x1 V y1 H x0 Z`). */
const veilOuter = (page: Page) =>
  page.getByTestId("layer-fade").locator("path").evaluate((p) => {
    const m = /^M(-?[\d.]+),(-?[\d.]+)H(-?[\d.]+)V(-?[\d.]+)H/.exec(p.getAttribute("d") ?? "")!;
    return { x0: Number(m[1]), y0: Number(m[2]), x1: Number(m[3]), y1: Number(m[4]) };
  });

test("S4B1-07: the veil's edge never shows while any of the content is in view, even at the minimum zoom with the content in a corner", async ({ page }) => {
  const { entity } = await ids();
  const customer = entity("Customer");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  await page.waitForTimeout(1000);
  const { pane, content } = await viewAndContent(page);
  const z = 0.1; // MIN_ZOOM
  // each corner of the content at the opposite corner of the pane: the view reaches furthest beyond the content there
  const corners = [
    { x: pane.w - content.x0 * z, y: pane.h - content.y0 * z }, // the content's top left at the pane's bottom right
    { x: -content.x1 * z, y: -content.y1 * z }, // its bottom right at the top left
    { x: -content.x1 * z, y: pane.h - content.y0 * z }, // its top right at the bottom left
    { x: pane.w - content.x0 * z, y: -content.y1 * z }, // its bottom left at the top right
  ];
  for (const [i, c] of corners.entries()) {
    await openCanvas(page, canvasUrl(), { ...c, zoom: z });
    await page.waitForTimeout(500);
    await fade(page, { focus: customer.id });
    await expect(page.getByTestId("layer-fade")).toHaveCount(1);
    const { zoom, view } = await viewAndContent(page);
    expect(zoom, `corner ${i}: the minimum zoom`).toBeCloseTo(z, 3);
    const veil = await veilOuter(page);
    expect(veil.x0, `corner ${i}: left`).toBeLessThanOrEqual(view.x0 + 1);
    expect(veil.y0, `corner ${i}: top`).toBeLessThanOrEqual(view.y0 + 1);
    expect(veil.x1, `corner ${i}: right`).toBeGreaterThanOrEqual(view.x1 - 1);
    expect(veil.y1, `corner ${i}: bottom`).toBeGreaterThanOrEqual(view.y1 - 1);
    await fade(page, null);
  }
  // and the veil is no larger than that: one pane at the minimum zoom beyond the content (T1), not 20,000 px
  await fade(page, { focus: customer.id });
  const veil = await veilOuter(page);
  expect(veil.x1 - veil.x0).toBeLessThan(content.x1 - content.x0 + (2 * pane.w) / z + 40);
  expect(veil.y1 - veil.y0).toBeLessThan(content.y1 - content.y0 + (2 * pane.h) / z + 40);
  await fade(page, null);
});

