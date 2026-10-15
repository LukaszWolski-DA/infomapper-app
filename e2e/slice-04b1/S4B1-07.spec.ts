// S4B1-07 (slice 4b-1, step 3: F4): the veil's holes follow what is lit. On “Customer & orders”, through the test hook
// (Focus has no UI until step 7):
//   - Focus on Customer cuts a hole at each lit card; dragging Customer and resizing it move and widen its hole;
//   - with Customer in a collapsed frame, its frame's block is lit and holed instead;
//   - a note pinned to a lit card is holed (stays lit); notes pinned to a faded card and free notes are not (fade);
//   - below 40 % (cards drawn as header and block) the holes still lie on the cards.

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
