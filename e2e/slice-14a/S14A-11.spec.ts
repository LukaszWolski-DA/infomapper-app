import { expect, test } from "./fixtures";
import {
  archive,
  canvasUrl,
  DEMO_NOTES,
  expectToast,
  hydrated,
  noteBox,
  noteEditor,
  noteMark,
  notePanelText,
  noteRow,
  notSaved,
  noteWithText,
  openCanvas,
  recordToasts,
  signInAs,
  WHOLE_CO,
  writeNote,
} from "./helpers";

// S14A-11 (item 9, F12): a note's text save refused because the workspace was archived meanwhile. The refusal's fresh
// page makes the canvas read-only: the note shows the draft with the mark (its read-only title) and no longer opens its
// editor; its panel, opened by the mark, shows the draft read-only and selectable with "Not saved. You can still copy
// it.". Nothing is written.

const COPY = "Not saved. You can still copy it.";
const MARK_READ_ONLY = "Not saved. Open the note's panel to copy your text.";

test("S14A-11: archived meanwhile: the note keeps the draft with the mark, not editable; the panel's text read-only and selectable", async ({ page }) => {
  const note = (await noteWithText(DEMO_NOTES.free))!;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);

  await archive();
  await writeNote(page, note.id, "Mine, before the archive.");
  await expectToast(page, /archived/i);
  const box = noteBox(page, note.id);
  await expect(box.getByTestId("note-text")).toHaveText("Mine, before the archive.");
  await expect(noteMark(page, note.id)).toHaveAttribute("title", MARK_READ_ONLY);
  // the canvas turned read-only: a double-click no longer opens the editor
  await expect(box).not.toHaveClass(/movable/);
  const body = await box.getByTestId("note-text").boundingBox();
  await page.mouse.dblclick(body!.x + body!.width / 2, body!.y + 6);
  await expect(noteEditor(page)).toHaveCount(0);

  await noteMark(page, note.id).click();
  const panel = page.getByTestId("panel-note");
  const text = notePanelText(page);
  await expect(notSaved(panel)).toHaveText(COPY);
  await expect(text).toHaveValue("Mine, before the archive.");
  await expect(text).toHaveJSProperty("readOnly", true);
  await text.selectText();
  expect(await text.evaluate((el: HTMLTextAreaElement) => el.value.slice(el.selectionStart, el.selectionEnd))).toBe("Mine, before the archive.");
  expect((await noteRow(note.id))!.body_text).toBe(note.body_text);
});
