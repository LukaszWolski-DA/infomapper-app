import { expect, test } from "./fixtures";
import {
  canvasUrl,
  card,
  changeNoteAsAnna,
  conflictLine,
  DEMO_NOTES,
  expectToast,
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
  WHOLE_CO,
  writeNote,
} from "./helpers";

const MARK_TITLE = "Your text is not saved. Click to see it in the note's panel.";

// S14A-04 (items 4–5, N1): the same conflict made on the canvas. The note keeps the typed text and shows "Not saved";
// clicking the mark selects the note and opens its panel with the conflict line; "Keep mine" stores it and the mark goes.
// The panels' lists (the canvas's overview, the selection's) show the draft too, marked "Not saved" (N4, step 4).

test("S14A-04: a note's text on the canvas: the draft stays with the mark, which opens the panel's line; Keep mine stores it", async ({ page }) => {
  const note = (await noteWithText(DEMO_NOTES.free))!;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);

  await changeNoteAsAnna(note.id, { text: "Theirs: nightly at 2 am." });
  await writeNote(page, note.id, "Mine: nightly at 1 am.");
  await expectToast(page, STALE);
  const box = noteBox(page, note.id);
  await expect(box.getByTestId("note-text")).toHaveText("Mine: nightly at 1 am.");
  await expect(noteMark(page, note.id)).toHaveText("Not saved");
  await expect(noteMark(page, note.id)).toHaveAttribute("title", MARK_TITLE);

  // the lists show the draft too, marked "Not saved" (N4 as completed in step 4): the canvas's overview panel with nothing
  // selected, then the selection's list with the note and a card
  await page.keyboard.press("Escape");
  const overviewRow = page.getByTestId("canvas-note-link").filter({ hasText: "Mine: nightly at 1 am." });
  await expect(overviewRow).toBeVisible();
  await expect(overviewRow.getByTestId("note-row-not-saved")).toHaveText("Not saved");
  await expect(page.getByTestId("canvas-note-link").filter({ hasText: "Theirs" })).toHaveCount(0);
  await selectNote(page, note.id);
  const head = (await card(page, "Customer").locator(".c-head .c-l2").boundingBox())!;
  await page.keyboard.down("Shift");
  await page.mouse.click(head.x + head.width / 3, head.y + head.height / 2);
  await page.keyboard.up("Shift");
  const selectionRow = page.getByTestId("selection-item").filter({ hasText: "Mine: nightly at 1 am." });
  await expect(selectionRow).toBeVisible();
  await expect(selectionRow.getByTestId("note-row-not-saved")).toHaveText("Not saved");

  // the mark: the note selected, its panel open with the line
  await page.keyboard.press("Escape");
  await noteMark(page, note.id).click();
  await expect(page.getByTestId("panel-note")).toBeVisible();
  const panel = page.getByTestId("panel-note");
  await expect(otherValue(panel)).toHaveText("Theirs: nightly at 2 am.");
  await expect(notePanelText(page)).toHaveValue("Mine: nightly at 1 am.");

  await keepMine(panel).click();
  await expect.poll(async () => (await noteRow(note.id))!.body_text).toBe("Mine: nightly at 1 am.");
  await expect(noteMark(page, note.id)).toHaveCount(0);
  await expect(conflictLine(panel)).toHaveCount(0);
  await expect(box.getByTestId("note-text")).toHaveText("Mine: nightly at 1 am.");
  // stored: the overview's row shows it without the mark
  await page.keyboard.press("Escape");
  await expect(overviewRow).toBeVisible();
  await expect(overviewRow.getByTestId("note-row-not-saved")).toHaveCount(0);
});
