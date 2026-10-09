import { expect, test } from "./fixtures";
import { box, canvasUrl, dragBetween, frameEl, frameNamed, item, makeFrame, openCanvas, signInAs, zoomOf } from "./helpers";

test("S2B-05: resizing a frame releases cards that end up outside and takes free cards that end up inside, never cards of another frame", async ({ page }) => {
  const area = await makeFrame({ x: 472, y: 0, width: 304, height: 344 }, { name: "Area" }); // Customer only
  const lines = await makeFrame({ x: 816, y: 528, width: 304, height: 304 }, { name: "Lines" }); // Order Line
  expect((await item("Customer")).frame_id).toBe(area);
  expect((await item("Sales Order")).frame_id).toBeNull();
  expect((await item("Order Line")).frame_id).toBe(lines);

  await signInAs(page, "Łukasz");
  // a little smaller than FRAMED, so the grown frame's corner stays clear of the Overview in the bottom right
  await openCanvas(page, canvasUrl(), { x: 10, y: 10, zoom: 0.4 });
  const zoom = await zoomOf(page);
  const resizeBy = async (dw: number, dh: number) => {
    const h = await box(frameEl(page, "Area").getByTestId("frame-resize"));
    const at = { x: h.x + h.width / 2, y: h.y + h.height / 2 };
    await dragBetween(page, at, { x: at.x + dw * zoom, y: at.y + dh * zoom });
  };

  // larger: 600 × 880 now covers the middles of Sales Order's and Order Line's headers
  await resizeBy(600 - 304, 880 - 344);
  await expect.poll(async () => (await frameNamed("Area"))!.height).toBe(880);
  expect((await frameNamed("Area"))!.width).toBe(600);
  await expect.poll(async () => (await item("Sales Order")).frame_id).toBe(area); // a free card joins
  expect((await item("Order Line")).frame_id).toBe(lines); // a card of another frame is never taken
  expect((await item("Customer")).frame_id).toBe(area);

  // smaller: 304 × 400 leaves Sales Order's header outside; it is released, Customer stays
  await resizeBy(304 - 600, 400 - 880);
  await expect.poll(async () => (await frameNamed("Area"))!.height).toBe(400);
  await expect.poll(async () => (await item("Sales Order")).frame_id).toBeNull();
  expect((await item("Customer")).frame_id).toBe(area);
  expect((await item("Order Line")).frame_id).toBe(lines);
});
