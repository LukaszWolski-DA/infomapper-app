import { expect, test } from "./fixtures";
import {
  canvasUrl,
  DEMO_NOTES,
  editNote,
  holdUntil,
  hydrated,
  noteBox,
  noteEditor,
  noteMark,
  notePanelText,
  noteRow,
  noteWithText,
  openCanvas,
  recordToasts,
  selectNote,
  signInAs,
  toasts,
  WHOLE_CO,
} from "./helpers";

// S14A-05 (item 7, answer 11): typing while a save is on its way. With the save's answer held (slice 13's test-only
// hold), the text typed after it was sent stays with the focus: on the canvas after a double-click back (the editor
// starts from the draft), in the panel in the same field; leaving the note saves the rest. No refusal, no mark.

test("S14A-05: on the canvas: a double-click back while the save is held starts from the draft; leaving saves the rest", async ({ page }) => {
  const note = (await noteWithText(DEMO_NOTES.free))!;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);

  const hold = await holdUntil(page, note.id);
  await editNote(page, note.id);
  await noteEditor(page).fill("First part.");
  await page.keyboard.press("Control+Enter");
  await expect.poll(hold.held).toBe(true);
  await expect(noteBox(page, note.id).getByTestId("note-text")).toHaveText("First part.");

  await editNote(page, note.id);
  await expect(noteEditor(page)).toHaveValue("First part.");
  await page.keyboard.press("End");
  await page.keyboard.type(" Second part.");
  hold.release();
  await hold.given;
  await expect(noteEditor(page)).toBeFocused();
  await expect(noteEditor(page)).toHaveValue("First part. Second part.");
  await page.keyboard.press("Control+Enter");
  await expect.poll(async () => (await noteRow(note.id))!.body_text).toBe("First part. Second part.");
  await expect(noteBox(page, note.id).getByTestId("note-text")).toHaveText("First part. Second part.");
  await expect(noteMark(page, note.id)).toHaveCount(0);
  expect(await toasts(page)).toEqual([]);
});

test("S14A-05: in the panel: text typed while the save is held stays with the focus; leaving saves the rest", async ({ page }) => {
  const note = (await noteWithText(DEMO_NOTES.free))!;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await selectNote(page, note.id);
  const text = notePanelText(page);

  const hold = await holdUntil(page, note.id);
  await text.fill("Panel one.");
  await text.press("Tab");
  await expect.poll(hold.held).toBe(true);
  await text.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Panel two.");
  hold.release();
  await hold.given;
  await expect(text).toBeFocused();
  await expect(text).toHaveValue("Panel one. Panel two.");
  await expect.poll(async () => (await noteRow(note.id))!.body_text).toBe("Panel one.");
  await text.press("Tab");
  await expect.poll(async () => (await noteRow(note.id))!.body_text).toBe("Panel one. Panel two.");
  await expect(noteBox(page, note.id).getByTestId("note-text")).toHaveText("Panel one. Panel two.");
  expect(await toasts(page)).toEqual([]);
});
