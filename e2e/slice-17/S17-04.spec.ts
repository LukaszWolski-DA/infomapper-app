// S17-04 (slice 17, item 4, D-72): a selected frame resizes from every edge and corner. The left edge moves the frame's
// x and narrows it, and a card left outside leaves the frame on release; the top-left corner moves both; a note pinned
// to the frame keeps its place and a free note is not claimed (D-20); one undo step restores it. No handles for a reader
// or on a collapsed frame.

import { createNote } from "../../src/domain/commands/note";
import { expect, test, type Page } from "./fixtures";
import { asLukasz } from "../slice-01b/helpers";
import {
  canvasUrl,
  collapse,
  dragBy,
  expectToast,
  frameEl,
  frameRow,
  item,
  emptyIn,
  makeFrame,
  openCanvas,
  RETAIL,
  SEED_IDS,
  signInAs,
  store,
  undoButton,
} from "./helpers";

const CO = SEED_IDS.canvasCustomerOrders;
const VIEW = { x: 40, y: 80, zoom: 0.5 };
// the bottom-right handle is in the frame; the selected frame's others in a layer above the lines (no line covers them)
const handle = (page: Page, dir: string) =>
  dir === "se" ? frameEl(page, "Around Customer").getByTestId("frame-resize") : page.getByTestId(`frame-resize-${dir}`);

/** A frame around Customer's card, with a note pinned to it and a free note inside it. */
async function frameAroundCustomer() {
  const c = await item("Customer");
  const frameId = await makeFrame({ x: c.x - 40, y: c.y - 64, width: 560, height: c.height + 200 }, { name: "Around Customer" });
  const s = store();
  const state = async () => ({
    canvas: await s.canvases.get(RETAIL, CO),
    items: await s.canvasItems.listOfCanvas(RETAIL, CO),
    frames: await s.frames.listOfCanvas(RETAIL, CO),
    notes: await s.notes.listOfCanvas(RETAIL, CO),
  });
  const s1 = await state();
  const pinned = (await asLukasz((ctx, access) => createNote(ctx, access, s1, { canvasId: CO, text: "Pinned to the frame", pin: { frameId } }))).note.id;
  // a free note just above and left of the frame, where its top-left corner will grow to
  const s2 = await state();
  const loose = (await asLukasz((ctx, access) => createNote(ctx, access, s2, { canvasId: CO, text: "Free beside it", x: c.x - 100, y: c.y - 104 }))).note.id;
  return { frameId, pinned, loose };
}
const noteRow = async (id: string) => (await store().notes.listOfCanvas(RETAIL, CO)).find((n) => n.id === id)!;

test("S17-04: the left edge and the top-left corner resize a frame; a card left outside leaves it; notes keep their place; one undo step", async ({ page }) => {
  const { frameId, pinned, loose } = await frameAroundCustomer();
  const f0 = await frameRow(frameId, CO);
  const pin0 = await noteRow(pinned);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEW);

  // only the selected frame shows the other handles
  await expect(handle(page, "w")).toHaveCount(0);
  // a click on an empty spot inside selects it (its name may lie under the pinned note)
  const inside = await emptyIn(page, "Around Customer");
  await page.mouse.click(inside.x, inside.y);
  for (const dir of ["nw", "ne", "sw", "n", "s", "w", "e"]) await expect(handle(page, dir)).toHaveCount(1);
  await expect(handle(page, "w")).toHaveCSS("cursor", "ew-resize");
  await expect(handle(page, "nw")).toHaveCSS("cursor", "nwse-resize");

  // the left edge 320 canvas px to the right (160 px on the screen at 50 %): x moves, the width shrinks, the right
  // edge stays, and Customer (its header's middle now outside) leaves the frame
  await dragBy(page, handle(page, "w"), 160, 0);
  await expect.poll(async () => (await frameRow(frameId, CO)).x).toBe(f0.x + 320);
  const f1 = await frameRow(frameId, CO);
  expect(f1.x + f1.width).toBe(f0.x + f0.width);
  await expect.poll(async () => (await item("Customer")).frame_id).toBeNull();
  // the pinned note keeps its place on the canvas: its offset moved back; the free note is not claimed
  const pin1 = await noteRow(pinned);
  expect([f1.x + pin1.x, f1.y + pin1.y]).toEqual([f0.x + pin0.x, f0.y + pin0.y]);
  expect((await noteRow(loose)).frame_id).toBeNull();

  // one undo step restores the frame, its card and the note
  await undoButton(page).click();
  await expectToast(page, "Undone: Resize frame");
  await expect.poll(async () => (await frameRow(frameId, CO)).x).toBe(f0.x);
  await expect.poll(async () => (await item("Customer")).frame_id).toBe(frameId);
  expect((await noteRow(pinned)).x).toBe(pin0.x);

  // the top-left corner moves both
  await expect(page.getByTestId("toast")).toHaveAttribute("data-visible", "false");
  const again = await emptyIn(page, "Around Customer");
  await page.mouse.click(again.x, again.y);
  await expect(handle(page, "nw")).toHaveCount(1);
  await dragBy(page, handle(page, "nw"), -40, -24);
  await expect.poll(async () => { const f = await frameRow(frameId, CO); return [f.x, f.y]; }).toEqual([f0.x - 80, f0.y - 48]);
  const f2 = await frameRow(frameId, CO);
  expect([f2.width, f2.height]).toEqual([f0.width + 80, f0.height + 48]);
  // the free note now lies inside the frame and is not claimed (D-20); Customer stays in it
  expect((await noteRow(loose)).frame_id).toBeNull();
  expect((await item("Customer")).frame_id).toBe(frameId);
});

test("S17-04: no handles for a reader, and none on a collapsed frame", async ({ page }) => {
  const { frameId } = await frameAroundCustomer();
  await signInAs(page, "Kasia Zielińska");
  await openCanvas(page, canvasUrl(), VIEW);
  const inside = await emptyIn(page, "Around Customer");
  await page.mouse.click(inside.x, inside.y);
  await expect(page.locator("[data-frame-handle]")).toHaveCount(0);

  await collapse(frameId);
  await page.reload();
  await expect(frameEl(page, "Around Customer")).toHaveCount(0); // drawn as a block
  await expect(page.locator("[data-frame-handle]")).toHaveCount(0);
});
