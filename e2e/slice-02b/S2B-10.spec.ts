import { expect, test } from "./fixtures";
import { canvasUrl, expectToast, frameEl, item, key, loadFrames, makeFrame, namePoint, openCanvas, signInAs, FRAMED } from "./helpers";

test("S2B-10: deleting a frame keeps its cards in place, free of frames, and Undo in the toast restores the frame with its members", async ({ page }) => {
  const area = await makeFrame({ x: 472, y: 0, width: 304, height: 856 }, { name: "Area" }); // Customer and Sales Order
  const before = { customer: await item("Customer"), so: await item("Sales Order") };
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);

  // select it by its name, then Delete
  const at = await namePoint(page, "Area");
  await page.mouse.click(at.x, at.y);
  await expect(frameEl(page, "Area")).toHaveAttribute("data-selected", "true");
  await key(page, "Delete");
  await expectToast(page, "Deleted the frame Area. Everything inside stays on the canvas.");
  await expect.poll(async () => (await loadFrames()).length).toBe(0);
  await expect(frameEl(page, "Area")).toHaveCount(0);
  for (const [name, b] of [["Customer", before.customer], ["Sales Order", before.so]] as const) {
    expect(await item(name), name).toMatchObject({ x: b.x, y: b.y, frame_id: null, deleted_at: null });
  }

  // Undo in the toast: the frame is back with both members
  await page.getByTestId("toast").filter({ hasText: "Deleted the frame Area." }).getByTestId("toast-action").click();
  await expect.poll(async () => (await loadFrames()).map((f) => f.id)).toEqual([area]);
  expect((await item("Customer")).frame_id).toBe(area);
  expect((await item("Sales Order")).frame_id).toBe(area);
  await expect(frameEl(page, "Area")).toBeVisible();
});
