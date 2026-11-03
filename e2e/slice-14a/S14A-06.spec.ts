import { expect, test } from "./fixtures";
import {
  canvasUrl,
  changeNoteAsAnna,
  conflictLine,
  DEMO_NOTES,
  holdUntil,
  hydrated,
  noteBox,
  noteMark,
  notePanelText,
  noteRow,
  notSaved,
  noteWithText,
  openCanvas,
  recordToasts,
  selectNote,
  signInAs,
  STALE,
  toasts,
  WHOLE_CO,
} from "./helpers";

// S14A-06 (item 6, F2, step 2 answers): a note's text save cut behind a conflict on its status. Anna changes the note's
// colour; this page's status change is refused as stale (its answer held while the text's save waits behind it), so the
// text's save is cut: one toast, the draft stays as "Not saved" in the panel and with the mark on the canvas, nothing is
// put back. The status shows the stored value. Leaving the field again saves the text.

test("S14A-06: a text save cut behind a refused status: Not saved with the mark, one toast; leaving the field saves it", async ({ page }) => {
  const note = (await noteWithText(DEMO_NOTES.free))!;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await selectNote(page, note.id);
  const panel = page.getByTestId("panel-note");
  const text = notePanelText(page);

  await changeNoteAsAnna(note.id, { color: "green" });
  const hold = await holdUntil(page, note.id);
  await panel.getByTestId("seg-note-status").getByRole("button", { name: "Resolved" }).click();
  await expect.poll(hold.held).toBe(true);
  await text.fill("Mine, cut behind the status.");
  await text.press("Tab");
  hold.release();
  await hold.given;

  await expect(notSaved(panel)).toHaveText("Not saved");
  await expect(conflictLine(panel)).toHaveCount(0);
  await expect(text).toHaveValue("Mine, cut behind the status.");
  await expect(noteBox(page, note.id).getByTestId("note-text")).toHaveText("Mine, cut behind the status.");
  await expect(noteMark(page, note.id)).toBeVisible();
  await expect(panel.getByTestId("seg-note-status").getByRole("button", { name: "Open" })).toHaveAttribute("aria-pressed", "true");
  await expect(noteBox(page, note.id)).toHaveAttribute("data-color", "green");
  const stored = (await noteRow(note.id))!;
  expect(stored.body_text).toBe(note.body_text);
  expect(stored.status).toBe("open");
  await page.waitForTimeout(500);
  expect((await toasts(page)).filter((t) => t === STALE)).toHaveLength(1);

  await text.click();
  await text.press("Tab");
  await expect.poll(async () => (await noteRow(note.id))!.body_text).toBe("Mine, cut behind the status.");
  await expect(notSaved(panel)).toHaveCount(0);
  await expect(noteMark(page, note.id)).toHaveCount(0);
});
