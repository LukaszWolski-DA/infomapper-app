// S4P-12 (slice 4p; slice 4b-1, step 3: F4 instead of F1): guards for fading (AD-24), on the e2e dev server where the
// canvas, the Overview's miniature and the fading layer count their commits. On “Customer & orders”:
//   - switching Focus on an entity, Focus on a requirement and a lit set given directly on and off re-renders neither the
//     canvas nor the miniature (S4P-12);
//   - what is lit: Focus on Customer cuts holes for its card and the cards it is related to; Focus on REQ-101 for its
//     scope's cards, with no row tinted (coverage colours come by themselves, step 6); a lit table cuts holes for the
//     notes pinned to it, not for a free note;
//   - panning and zooming with fading on re-render neither the canvas nor the fading layer (no script per frame);
//   - a drag and a resize with fading on commit the canvas no more than the same with fading off, and the lit card's hole
//     follows it during and after them. S4B1-07 checks the holes further (collapsing, notes, zoom levels).
// The other S4P-12 guards: S2C-12, S3A-14-idle, S3B-15-idle and S3B-13 in every run, and the viewport counts in the
// measurement build (S4A-14-elements.spec.ts, slice 3b's counts plus the overlay container).

import { expect, test, type Page } from "../slice-04a/fixtures";
import { box, canvasUrl, card, holeAt, ids, nodeRect, openCanvas, paneMiddle, requirementByKey, signInAs, veilHoles, WHOLE } from "../slice-04b1/helpers";

const counters = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __imCanvasCommits?: number; __imMiniatureCommits?: number; __imFadeCommits?: number };
    return { canvas: w.__imCanvasCommits ?? 0, miniature: w.__imMiniatureCommits ?? 0, fade: w.__imFadeCommits ?? 0 };
  });
const fade = (page: Page, request: unknown) => page.evaluate((r) => (window as unknown as { __imFade: (r: unknown) => void }).__imFade(r), request);
/** A lit set given directly (the capability for 4b): the tables, nothing else. */
const litTables = (page: Page, tableIds: string[], key: string) =>
  page.evaluate(
    ([tableIds, key]) =>
      (window as unknown as { __imFade: (r: unknown) => void }).__imFade({
        key,
        lit: { entities: new Set(), tables: new Set(tableIds), rows: new Map(), mappings: new Set(), relationships: new Set() },
      }),
    [tableIds, key] as const,
  );
/** Whether the veil has a hole at the card's rectangle now. */
const holed = async (page: Page, name: string) => holeAt(await veilHoles(page), await nodeRect(card(page, name)));

/** Drags a card by its header, checking `during` after the moves and before the release. */
async function dragHead(page: Page, name: string, during?: () => Promise<void>) {
  const head = await box(card(page, name).locator(".c-head .c-l2"));
  await page.mouse.move(head.x + 20, head.y + head.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(head.x + 20 + i * 10, head.y + head.height / 2 + i * 5);
  await during?.();
  await page.mouse.up();
}

test("S4P-12: switching, panning, zooming and dragging with fading on re-render neither the canvas nor the miniature beyond what they do without it; Focus on an entity or a requirement and a given lit set light the right cards and notes; the lit card's hole follows a drag and a resize", async ({ page }) => {
  const { entity, model } = await ids();
  const customer = entity("Customer");
  const orderLine = model.sourceTables.find((t) => t.name === "order_line")!;
  const req101 = await requirementByKey("REQ-101");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  await page.waitForTimeout(1500);
  const before = await counters(page);
  expect(before.canvas).toBeGreaterThan(0);
  const layer = page.getByTestId("layer-fade");

  // Focus on Customer: Customer, the two tables that feed it and Sales Order (places), each with its hole
  await fade(page, { focus: customer.id });
  await expect(layer).toHaveAttribute("data-fade", `focus:${customer.id}`);
  expect(Number(await layer.getAttribute("data-lit-cards"))).toBe(4);
  expect(await holed(page, "Customer")).toBe(true);
  expect(await holed(page, "Sales Order")).toBe(true);
  expect(await holed(page, "order_header")).toBe(false);
  expect(await veilHoles(page)).toHaveLength(4);
  await fade(page, null);
  await expect(layer).toHaveCount(0);

  // Focus on REQ-101 (an entity link, Customer): Customer alone (slice 4b-1, PRD item 9: an entity link does not bring its
  // attributes), no row tinted
  await fade(page, { focus: { t: "requirement", id: req101.id } });
  await expect(layer).toHaveAttribute("data-fade", `focus:requirement:${req101.id}`);
  expect(await holed(page, "Customer")).toBe(true);
  expect(Number(await layer.getAttribute("data-lit-cards"))).toBe(1);
  await expect(page.getByTestId("lit-row-covered")).toHaveCount(0);
  await expect(page.getByTestId("lit-row-gap")).toHaveCount(0);
  await fade(page, null);

  // a lit set given directly: the table order_line; the two notes pinned to it get holes, the free note does not
  await litTables(page, [orderLine.id], "order_line");
  await expect(layer).toHaveAttribute("data-fade", "lit:order_line");
  expect(await holed(page, "order_line")).toBe(true);
  expect(Number(await layer.getAttribute("data-lit-notes"))).toBe(2);
  expect(await veilHoles(page)).toHaveLength(3);
  await fade(page, null);
  await expect(layer).toHaveCount(0);
  const afterSwitching = await counters(page);
  expect({ canvas: afterSwitching.canvas, miniature: afterSwitching.miniature }, "canvas and miniature commits after switching").toEqual({ canvas: before.canvas, miniature: before.miniature });

  // pan and zoom with Focus on: no canvas, miniature or fading commit
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
  await fade(page, null);

  // the same drag with fading off and on: no more canvas or miniature commits with it on; the lit card above the veil
  await openCanvas(page, canvasUrl(), WHOLE);
  await page.waitForTimeout(1000);
  let start = await counters(page);
  await dragHead(page, "Customer");
  await page.waitForTimeout(1000);
  const offDrag = await counters(page);
  const offCost = { canvas: offDrag.canvas - start.canvas, miniature: offDrag.miniature - start.miniature };
  await openCanvas(page, canvasUrl(), WHOLE);
  await fade(page, { focus: customer.id });
  await expect(layer).toHaveCount(1);
  await page.waitForTimeout(1000);
  start = await counters(page);
  await dragHead(page, "Customer", async () => {
    await expect.poll(() => holed(page, "Customer"), "the lit card's hole follows it during the drag").toBe(true);
  });
  await page.waitForTimeout(1000);
  const onDrag = await counters(page);
  expect({ canvas: onDrag.canvas - start.canvas, miniature: onDrag.miniature - start.miniature }, "a drag's commits with fading on").toEqual(offCost);
  await expect.poll(() => holed(page, "Customer"), "the lit card's hole after the drag").toBe(true);
  // a resize too
  const handle = await box(card(page, "Customer").getByTestId("handle-card-width"));
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 40);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(handle.x + handle.width / 2 + i * 10, handle.y + 40);
  await page.mouse.up();
  await expect.poll(() => holed(page, "Customer"), "the lit card's hole after a resize").toBe(true);
  await fade(page, null);
});
