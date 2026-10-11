import { expect, test } from "./fixtures";
import {
  box,
  card,
  DEMO_NOTES,
  dragBetween,
  frameNamed,
  headPoint,
  item,
  makeFrame,
  namePoint,
  noteEl,
  notePoint,
  noteWithText,
  openCanvas,
  signInAs,
  toolboxAt,
  canvasUrl,
} from "./helpers";
import type { Page } from "./fixtures";

/** The right of Customer & orders at 60 %: the demo's free note, order_line and its notes, room above a frame's name. */
const VIEW = { x: -560, y: 40, zoom: 0.6 };
const menuItem = (page: Page, name: string) => page.getByTestId("menu-toolbox").getByRole("menuitem", { name });

test("S3A-08: a free note dropped in a frame moves with it and is hidden while it is collapsed; a pinned note follows its card while dragged, with a dashed tether; unpinning keeps it in place as a free note; removing its card from the canvas makes it a free note", async ({ page }) => {
  test.setTimeout(120_000);
  // a frame around the demo's free note (1176, 200), clear of order_line (1176, 600); drawing it claims no note
  await makeFrame({ x: 1104, y: 120, width: 400, height: 320 }, { name: "Remarks" });
  const frame0 = (await frameNamed("Remarks"))!;
  expect((await noteWithText(DEMO_NOTES.free))!.frame_id).toBeNull();
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEW);

  // dropped (moved a little) inside the frame, it joins it
  const p = await notePoint(page, DEMO_NOTES.free);
  await dragBetween(page, p, { x: p.x + 24, y: p.y + 24 });
  await expect.poll(async () => (await noteWithText(DEMO_NOTES.free))!.frame_id).toBe(frame0.id);
  const inFrame = (await noteWithText(DEMO_NOTES.free))!;

  // the frame moves by its name: the note goes with it, by the same amount
  const name = await namePoint(page, "Remarks");
  await dragBetween(page, name, { x: name.x + 96, y: name.y + 48 });
  await expect.poll(async () => (await frameNamed("Remarks"))!.x).not.toBe(frame0.x);
  const frame1 = (await frameNamed("Remarks"))!;
  await expect.poll(async () => {
    const n = (await noteWithText(DEMO_NOTES.free))!;
    return [n.x - inFrame.x, n.y - inFrame.y];
  }).toEqual([frame1.x - frame0.x, frame1.y - frame0.y]);

  // collapsed, the frame hides its free note; expanded, it shows again
  await toolboxAt(page, await namePoint(page, "Remarks"));
  await page.getByTestId("toolbox-frame-collapse").click();
  await expect(noteEl(page, DEMO_NOTES.free)).toHaveCount(0);
  await page.getByTestId("block").getByTestId("button-block-expand").click();
  await expect(noteEl(page, DEMO_NOTES.free)).toHaveCount(1);

  // a pinned note follows order_line while it is dragged, linked by a dashed tether
  const pinned = noteEl(page, DEMO_NOTES.pinned);
  const tether = page.locator(`[data-testid="tether"]`).first();
  await expect(tether).toHaveCount(1);
  expect(await tether.evaluate((e) => getComputedStyle(e).strokeDasharray)).not.toBe("none");
  const n0 = await box(pinned), c0 = await box(card(page, "order_line"));
  const at = await headPoint(page, "order_line");
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(at.x - i * 6, at.y - i * 4);
  // while the mouse is still down, the note has moved with the card
  await expect.poll(async () => Math.round((await box(pinned)).x - (await box(card(page, "order_line"))).x)).toBe(Math.round(n0.x - c0.x));
  expect((await box(pinned)).x).toBeLessThan(n0.x - 30);
  await page.mouse.up();
  const ordline = await item("order_line");
  await expect.poll(async () => (await item("order_line")).x).not.toBe(1176);
  // its offset is unchanged
  expect((await noteWithText(DEMO_NOTES.pinned))!).toMatchObject({ pin_canvas_item_id: ordline.id, x: 0, y: 248 });

  // unpinned, it stays where it is, as a free note
  const before = await box(pinned);
  await toolboxAt(page, await notePoint(page, DEMO_NOTES.pinned));
  await menuItem(page, "Unpin (make it a free note)").click();
  const card1 = await item("order_line");
  await expect.poll(async () => (await noteWithText(DEMO_NOTES.pinned))!.pin_canvas_item_id).toBeNull();
  expect((await noteWithText(DEMO_NOTES.pinned))!).toMatchObject({ x: card1.x, y: card1.y + 248 });
  const after = await box(pinned);
  expect([Math.round(after.x), Math.round(after.y)]).toEqual([Math.round(before.x), Math.round(before.y)]);

  // order_line taken off the canvas: its other (resolved) note stays at its place as a free note
  const resolved = (await noteWithText(DEMO_NOTES.resolved))!;
  expect(resolved.pin_canvas_item_id).toBe(card1.id);
  await card(page, "order_line").getByTestId("card-name").click();
  await page.getByTestId("button-remove-card").click();
  await expect.poll(async () => (await noteWithText(DEMO_NOTES.resolved))!.pin_canvas_item_id).toBeNull();
  expect((await noteWithText(DEMO_NOTES.resolved))!).toMatchObject({ x: card1.x + resolved.x, y: card1.y + resolved.y, frame_id: null });
});
