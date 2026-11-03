import { expect, test } from "./fixtures";
import {
  canvasUrl,
  changeNoteAsAnna,
  conflictLine,
  DEMO_NOTES,
  editNote,
  expectToast,
  hydrated,
  noteBox,
  noteEditor,
  noteMark,
  notePanelText,
  noteRow,
  noteWithText,
  openCanvas,
  otherValue,
  recordToasts,
  selectNote,
  signInAs,
  STALE,
  WHOLE_CO,
  writeNote,
} from "./helpers";

// S14A-07 (item 8, F10): Escape puts the stored text back; with a refused draft it is "Use this". On the canvas Escape
// in the editor ends editing and drops the draft; in the panel it puts the stored text into the field. Nothing is stored.

test("S14A-07: Escape on the canvas: without a draft the stored text stays; with a refused draft it takes Anna's", async ({ page }) => {
  const note = (await noteWithText(DEMO_NOTES.free))!;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  const body = noteBox(page, note.id).getByTestId("note-text");

  await editNote(page, note.id);
  await noteEditor(page).fill("Never saved");
  await page.keyboard.press("Escape");
  await expect(noteEditor(page)).toHaveCount(0);
  await expect(body).toHaveText(note.body_text!);

  await changeNoteAsAnna(note.id, { text: "Theirs." });
  await writeNote(page, note.id, "Mine.");
  await expectToast(page, STALE);
  await expect(noteMark(page, note.id)).toBeVisible();
  const version = (await noteRow(note.id))!.version;
  await editNote(page, note.id);
  await expect(noteEditor(page)).toHaveValue("Mine.");
  await page.keyboard.press("Escape");
  await expect(noteEditor(page)).toHaveCount(0);
  await expect(body).toHaveText("Theirs.");
  await expect(noteMark(page, note.id)).toHaveCount(0);
  await page.waitForTimeout(500);
  expect((await noteRow(note.id))!.version).toBe(version);
});

test("S14A-07: Escape in the panel: the stored text back; with the conflict line it is Use this", async ({ page }) => {
  const note = (await noteWithText(DEMO_NOTES.free))!;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await selectNote(page, note.id);
  const panel = page.getByTestId("panel-note");
  const text = notePanelText(page);

  await text.fill("Typed, then dropped");
  await text.press("Escape");
  await expect(text).toHaveValue(note.body_text!);

  await changeNoteAsAnna(note.id, { text: "Theirs." });
  await text.fill("Mine.");
  await text.press("Tab");
  await expect(otherValue(panel)).toHaveText("Theirs.");
  const version = (await noteRow(note.id))!.version;
  await text.focus();
  await text.press("Escape");
  await expect(text).toHaveValue("Theirs.");
  await expect(conflictLine(panel)).toHaveCount(0);
  await expect(noteMark(page, note.id)).toHaveCount(0);
  await expect(noteBox(page, note.id).getByTestId("note-text")).toHaveText("Theirs.");
  await page.waitForTimeout(500);
  expect((await noteRow(note.id))!.version).toBe(version);
});
