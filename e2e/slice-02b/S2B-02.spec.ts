import { expect, test } from "./fixtures";
import { canvasUrl, dragCardBy, frameNamed, item, makeFrame, openCanvas, signInAs, FRAMED, zoomOf } from "./helpers";

test("S2B-02: dragging Order Line into the frame makes it a member and the frame grows to hold it; dragging it out makes it a member of no frame; where two frames overlap, the smaller one wins", async ({ page }) => {
  // the frame holds Customer and Sales Order, with room below Sales Order
  const area = await makeFrame({ x: 472, y: 0, width: 304, height: 900 }, { name: "Area" });
  expect((await item("Sales Order")).frame_id).toBe(area);
  const ol = await item("Order Line");
  expect(ol.frame_id).toBeNull();

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  const zoom = await zoomOf(page);

  // in: the middle of its header lands inside the frame, its bottom sticks out, so the frame grows (24 px below)
  await dragCardBy(page, "Order Line", (496 - ol.x) * zoom, (832 - ol.y) * zoom);
  await expect.poll(async () => (await item("Order Line")).frame_id).toBe(area);
  const inside = await item("Order Line");
  expect(inside).toMatchObject({ x: 496, y: 832 });
  const grown = (await frameNamed("Area"))!;
  expect(grown.y + grown.height).toBe(inside.y + inside.height + 24);
  expect(grown).toMatchObject({ x: 472, width: 304 });

  // out: an empty spot right of Customer, in no frame
  await dragCardBy(page, "Order Line", (896 - inside.x) * zoom, (40 - inside.y) * zoom);
  await expect.poll(async () => (await item("Order Line")).frame_id).toBeNull();
  const out = await item("Order Line");
  expect(out).toMatchObject({ x: 896, y: 40 });

  // two overlapping frames: a large one that takes Order Line, then a smaller one over it (which does not take it,
  // D-06); after a drop inside both, the smaller one wins (D-05)
  const big = await makeFrame({ x: 872, y: 0, width: 640, height: 560 }, { name: "Big" });
  const small = await makeFrame({ x: 880, y: 16, width: 320, height: 300 }, { name: "Small" });
  expect((await item("Order Line")).frame_id).toBe(big);
  await openCanvas(page, canvasUrl(), FRAMED);
  await dragCardBy(page, "Order Line", 16 * zoom, 16 * zoom);
  await expect.poll(async () => (await item("Order Line")).frame_id).toBe(small);
});
