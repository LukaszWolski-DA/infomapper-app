import { expect, test } from "./fixtures";
import {
  canvasUrl,
  changeNoteAsAnna,
  conflictLine,
  DEMO_NOTES,
  expectToast,
  groupsOf,
  hydrated,
  keepMine,
  noteBox,
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
  undo,
  useThis,
  WHOLE_CO,
} from "./helpers";

// S14A-03 (items 4–5, D-66): a note's text in its panel. Anna changes the text as another session; this page's save is
// refused and its fresh page comes with the refusal: the field keeps the typed text with "Changed meanwhile to: …", and
// the note on the canvas shows the same draft with its mark. "Keep mine" stores it (one change group, one undo step);
// in a repeat, "Use this" shows Anna's text and stores nothing.

test("S14A-03: a note's text in its panel: the conflict line, Keep mine stores mine as one undo step; Use this takes Anna's", async ({ page }) => {
  const note = (await noteWithText(DEMO_NOTES.free))!;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await selectNote(page, note.id);
  const panel = page.getByTestId("panel-note");
  const text = notePanelText(page);

  await changeNoteAsAnna(note.id, { text: "Theirs: nightly at 2 am." });
  await text.fill("Mine: nightly at 1 am.");
  await text.press("Tab");
  await expectToast(page, STALE);
  await expect(conflictLine(panel)).toContainText("Changed meanwhile to:");
  await expect(otherValue(panel)).toHaveText("Theirs: nightly at 2 am.");
  await expect(text).toHaveValue("Mine: nightly at 1 am.");
  // the canvas shows the draft, marked
  await expect(noteBox(page, note.id).getByTestId("note-text")).toHaveText("Mine: nightly at 1 am.");
  await expect(noteMark(page, note.id)).toBeVisible();

  await keepMine(panel).click();
  await expect.poll(async () => (await noteRow(note.id))!.body_text).toBe("Mine: nightly at 1 am.");
  await expect(conflictLine(panel)).toHaveCount(0);
  await expect(noteMark(page, note.id)).toHaveCount(0);
  const texts = (await groupsOf(note.id)).map((g) => g.after?.body_text).filter(Boolean);
  expect(texts.slice(-2)).toEqual(["Theirs: nightly at 2 am.", "Mine: nightly at 1 am."]);
  await undo(page);
  await expect.poll(async () => (await noteRow(note.id))!.body_text).toBe("Theirs: nightly at 2 am.");
  await expect(text).toHaveValue("Theirs: nightly at 2 am.");

  // a repeat: Use this shows Anna's text and stores nothing
  await changeNoteAsAnna(note.id, { text: "Theirs again." });
  const version = (await noteRow(note.id))!.version;
  await text.fill("Mine again.");
  await text.press("Tab");
  await expect(otherValue(panel)).toHaveText("Theirs again.");
  await useThis(panel).click();
  await expect(text).toHaveValue("Theirs again.");
  await expect(conflictLine(panel)).toHaveCount(0);
  await expect(noteBox(page, note.id).getByTestId("note-text")).toHaveText("Theirs again.");
  await expect(noteMark(page, note.id)).toHaveCount(0);
  await page.waitForTimeout(500);
  expect((await noteRow(note.id))!.version).toBe(version);
});
