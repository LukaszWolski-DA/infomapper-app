import { moveNote } from "../../src/domain/commands/note";
import { expect, test } from "./fixtures";
import {
  asLukasz,
  CO,
  DEMO_NOTES,
  expectToast,
  frameNamed,
  headPoint,
  item,
  key,
  lasso,
  loadNotes,
  makeFrame,
  noteWithText,
  notePoint,
  openCanvas,
  RETAIL,
  shiftClick,
  signInAs,
  store,
  undo,
  canvasUrl,
} from "./helpers";
import type { Page } from "./fixtures";

/** The right of Customer & orders at 50 %: the demo's free note, order_line and its notes, above the status bar. */
const VIEW = { x: -450, y: 0, zoom: 0.5 };
const noteMarks = (page: Page) => page.getByTestId("mark-selected-note");
const kinds = (page: Page) => page.getByTestId("selection-kinds");

test("S3A-10: notes take part in the selection: click, Shift+click, lasso (not when their frame is caught), Ctrl+A for free notes outside frames, group drag and nudge (a pinned note moves once), Delete", async ({ page }) => {
  test.setTimeout(150_000);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEW);

  // a click selects a note; Shift+click adds a card to it
  await page.mouse.click(...(Object.values(await notePoint(page, DEMO_NOTES.free)) as [number, number]));
  await expect(page.getByTestId("panel-note")).toBeVisible();
  await shiftClick(page, await headPoint(page, "order_line"));
  await expect(kinds(page)).toHaveText("1 table, 1 note.");
  await expect(noteMarks(page)).toHaveCount(1);
  // Shift+click on the note takes it out again
  await shiftClick(page, await notePoint(page, DEMO_NOTES.free));
  await expect(page.getByTestId("panel-source-table")).toBeVisible();
  await key(page, "Escape");

  // a lasso fully around the free note selects it
  await lasso(page, { x: 1150, y: 170 }, { x: 1420, y: 380 });
  await expect(page.getByTestId("panel-note")).toBeVisible();
  await expect(page.getByTestId("input-note-panel-text")).toHaveValue(new RegExp(`^${DEMO_NOTES.free}`));

  // Ctrl+A: every card in no frame and the free note in no frame, not the notes pinned to order_line; since slice 4b-2
  // REQ-104's requirement card (L)
  await key(page, "Control+a");
  await expect(kinds(page)).toHaveText("3 entities, 4 tables, 1 note, 1 requirement.");
  await expect(noteMarks(page)).toHaveCount(1);
  await key(page, "Escape");

  // a group of order_line, its pinned (open) note and the free note: dragged by the card, each moves once
  const free0 = (await noteWithText(DEMO_NOTES.free))!, pinned0 = (await noteWithText(DEMO_NOTES.pinned))!, card0 = await item("order_line");
  await page.mouse.click(...(Object.values(await headPoint(page, "order_line")) as [number, number]));
  await expect(page.getByTestId("panel-source-table")).toBeVisible();
  await shiftClick(page, await notePoint(page, DEMO_NOTES.pinned));
  await expect(kinds(page)).toHaveText("1 table, 1 note.");
  await shiftClick(page, await notePoint(page, DEMO_NOTES.free));
  await expect(kinds(page)).toHaveText("1 table, 2 notes.");
  const at = await headPoint(page, "order_line");
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(at.x - i * 4.8, at.y - i * 4.8);
  await page.mouse.up();
  await expect.poll(async () => (await item("order_line")).x).not.toBe(card0.x);
  const card1 = await item("order_line");
  const d = { x: card1.x - card0.x, y: card1.y - card0.y };
  expect(d.x).toBeLessThan(0);
  await expect.poll(async () => {
    const n = (await noteWithText(DEMO_NOTES.free))!;
    return [n.x - free0.x, n.y - free0.y];
  }).toEqual([d.x, d.y]);
  // the pinned note follows its card: its offset is unchanged
  expect((await noteWithText(DEMO_NOTES.pinned))!).toMatchObject({ x: pinned0.x, y: pinned0.y, version: pinned0.version });

  // nudge: two presses, one undo step
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await item("order_line")).x).toBe(card1.x + 16);
  await expect.poll(async () => (await noteWithText(DEMO_NOTES.free))!.x).toBe(free0.x + d.x + 16);
  expect((await noteWithText(DEMO_NOTES.pinned))!.x).toBe(pinned0.x);
  await undo(page);
  await expect.poll(async () => (await item("order_line")).x).toBe(card1.x);
  await expect.poll(async () => (await noteWithText(DEMO_NOTES.free))!.x).toBe(free0.x + d.x);
  await key(page, "Escape");

  // a frame around the free note, with the note in it: a lasso around the whole frame catches the frame, not the note
  await makeFrame({ x: 1040, y: 80, width: 480, height: 400 }, { name: "Remarks" });
  const frame = (await frameNamed("Remarks"))!;
  const free1 = (await noteWithText(DEMO_NOTES.free))!;
  const state = {
    canvas: await store().canvases.get(RETAIL, CO),
    items: await store().canvasItems.listOfCanvas(RETAIL, CO),
    frames: await store().frames.listOfCanvas(RETAIL, CO),
    notes: await loadNotes(),
  };
  await asLukasz((ctx, access) => moveNote(ctx, access, state, { noteId: free1.id, expectedVersion: free1.version, x: 1120, y: 160 }));
  expect((await noteWithText(DEMO_NOTES.free))!.frame_id).toBe(frame.id);
  await openCanvas(page, canvasUrl(), VIEW);
  // from the bottom left: the frame's label (with its collapse button) reaches left of the frame's top corner
  await lasso(page, { x: 980, y: 520 }, { x: 1560, y: 40 });
  await expect(page.getByTestId("panel-frame")).toBeVisible();
  await expect(noteMarks(page)).toHaveCount(0);
  // Ctrl+A leaves a note in a frame out (the frame stands for it); REQ-104's card is in no frame (slice 4b-2)
  await key(page, "Control+a");
  await expect(kinds(page)).toHaveText("3 entities, 4 tables, 1 frame, 1 requirement.");
  await key(page, "Escape");

  // Delete removes a selected note
  await page.mouse.click(...(Object.values(await notePoint(page, DEMO_NOTES.free)) as [number, number]));
  await expect(page.getByTestId("panel-note")).toBeVisible();
  await key(page, "Delete");
  await expectToast(page, "Note deleted");
  await expect.poll(async () => (await noteWithText(DEMO_NOTES.free)) ?? null).toBeNull();
});
