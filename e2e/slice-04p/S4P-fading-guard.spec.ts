// Slice 4p: guards for fading (F1, AD-24), on the e2e dev server where the canvas, the Overview's miniature and the
// fading layer count their commits. On “Customer & orders”:
//   - switching Focus, a lens and a lit set given directly on and off re-renders neither the canvas nor the miniature
//     (S4P-12);
//   - what is lit: Focus on Customer lights its card and the cards it is related to; REQ-101's lens tints Customer's
//     rows covered (5) and gap (3), the seed's coverage; a lit table lifts the notes pinned to it, not a free note;
//   - panning and zooming with fading on re-render neither the canvas nor the fading layer (no script per frame);
//   - a drag and a resize with fading on commit the canvas no more than the same with fading off, and the lit card stays
//     above the veil during and after them (the stylesheet rule wins over React Flow's own z-index).
// Part of S4P-12's test at step 5.

import { expect, test, type Page } from "../slice-04a/fixtures";
import { box, canvasUrl, card, ids, openCanvas, paneMiddle, requirementByKey, signInAs, WHOLE } from "../slice-04a/helpers";

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
const zIndex = (page: Page, name: string) => card(page, name).evaluate((el) => getComputedStyle(el).zIndex);

/** Drags a card by its header, checking `during` after the moves and before the release. */
async function dragHead(page: Page, name: string, during?: () => Promise<void>) {
  const head = await box(card(page, name).locator(".c-head .c-l2"));
  await page.mouse.move(head.x + 20, head.y + head.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(head.x + 20 + i * 10, head.y + head.height / 2 + i * 5);
  await during?.();
  await page.mouse.up();
}

test("S4P fading (guard): switching, panning, zooming and dragging with fading on re-render neither the canvas nor the miniature beyond what they do without it; Focus, a lens and a given lit set light the right cards, rows and notes; the lit card stays above the veil during and after a drag", async ({ page }) => {
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

  // Focus on Customer: Customer, the two tables that feed it and Sales Order (places)
  await fade(page, { focus: customer.id });
  await expect(layer).toHaveAttribute("data-fade", `focus:${customer.id}`);
  expect(Number(await layer.getAttribute("data-lit-cards"))).toBe(4);
  await expect.poll(() => zIndex(page, "Customer")).toBe("2");
  await expect.poll(() => zIndex(page, "Sales Order")).toBe("2");
  expect(await zIndex(page, "order_header")).not.toBe("2");
  await fade(page, null);
  await expect(layer).toHaveCount(0);
  expect(await zIndex(page, "Customer")).not.toBe("2");

  // REQ-101 (Customer): its 8 attributes tinted, 5 covered and 3 gaps (slice 4a's coverage)
  await fade(page, { lens: req101.id });
  await expect(layer).toHaveAttribute("data-fade", `lens:${req101.id}`);
  await expect(page.getByTestId("lit-row-covered")).toHaveCount(5);
  await expect(page.getByTestId("lit-row-gap")).toHaveCount(3);
  await fade(page, null);

  // a lit set given directly: the table order_line; the two notes pinned to it are lifted, the free note is not
  await litTables(page, [orderLine.id], "order_line");
  await expect(layer).toHaveAttribute("data-fade", "lit:order_line");
  await expect.poll(() => zIndex(page, "order_line")).toBe("2");
  const noteZ = await page.getByTestId("note").evaluateAll((els) => els.map((el) => [el.textContent?.includes("order_line") ?? false, getComputedStyle(el).zIndex] as const));
  expect(noteZ.filter(([pinned]) => pinned).every(([, z]) => z === "2")).toBe(true);
  expect(noteZ.filter(([pinned]) => !pinned).every(([, z]) => z !== "2")).toBe(true);
  expect(noteZ.filter(([pinned]) => pinned)).toHaveLength(2);
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
    expect(await zIndex(page, "Customer"), "the lit card above the veil during the drag").toBe("2");
  });
  await page.waitForTimeout(1000);
  const onDrag = await counters(page);
  expect({ canvas: onDrag.canvas - start.canvas, miniature: onDrag.miniature - start.miniature }, "a drag's commits with fading on").toEqual(offCost);
  expect(await zIndex(page, "Customer"), "the lit card above the veil after the drag").toBe("2");
  // a resize too
  const handle = await box(card(page, "Customer").getByTestId("handle-card-width"));
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 40);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(handle.x + handle.width / 2 + i * 10, handle.y + 40);
  await page.mouse.up();
  await expect.poll(() => zIndex(page, "Customer"), "the lit card above the veil after a resize").toBe("2");
  await fade(page, null);
});
