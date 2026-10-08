import { expect, test } from "./fixtures";
import { canvasUrl, dragBetween, frameEl, item, key, loadFrames, makeFrame, openCanvas, screenPoint, signInAs, FRAMED } from "./helpers";

test("S2B-01: the Frame tool (A) draws a frame around Customer and Sales Order: a free frame “New frame”, selected, name ready to type, both cards in it; a card already in another frame is not taken", async ({ page }) => {
  // Order Line is already in the frame “Lines”; the new frame will cover it too
  const ol = await item("Order Line");
  const lines = await makeFrame({ x: 816, y: 528, width: 304, height: ol.height + 72 }, { name: "Lines" });

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  await expect(page.getByTestId("button-tool-frame")).toBeVisible();
  await key(page, "a");
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-mode", "frame");
  // drag from above left of Customer to below Sales Order, past Order Line and its frame
  await dragBetween(page, await screenPoint(page, { x: 464, y: 8 }), await screenPoint(page, { x: 1136, y: 864 }));

  await expect.poll(async () => (await loadFrames()).length).toBe(2);
  const drawn = (await loadFrames()).find((f) => f.id !== lines)!;
  expect(drawn).toMatchObject({ name: "New frame", kind: "free", color: "#7C8998", concept_id: null, source_system_id: null, collapsed: false });
  expect(Math.abs(drawn.x - 464)).toBeLessThanOrEqual(8);
  expect(Math.abs(drawn.y - 8)).toBeLessThanOrEqual(8);
  expect([drawn.x, drawn.y, drawn.width, drawn.height].every((v) => v % 8 === 0)).toBe(true); // snapped to 8 px
  expect((await item("Customer")).frame_id).toBe(drawn.id);
  expect((await item("Sales Order")).frame_id).toBe(drawn.id);
  expect((await item("Order Line")).frame_id).toBe(lines); // not taken from its frame (D-06)
  expect((await item("customers")).frame_id).toBeNull();

  // selected, its name ready to type; the tool is off after one frame
  await expect(frameEl(page, "New frame")).toHaveAttribute("data-selected", "true");
  await expect(page.getByTestId("panel-frame")).toBeVisible();
  await expect(page.getByTestId("input-frame-name")).toBeFocused();
  await expect(page.getByTestId("area-canvas")).not.toHaveAttribute("data-mode", "frame");
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Customers and orders");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await loadFrames()).find((f) => f.id === drawn.id)!.name).toBe("Customers and orders");
  await expect(frameEl(page, "Customers and orders")).toBeVisible();
});
