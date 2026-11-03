import { addPerson, signInWithPassword, signOutViaMenu } from "../slice-08/helpers";
import { expect, test } from "./fixtures";
import {
  canvasUrl,
  DEMO_NOTES,
  deleteNoteAsAnna,
  expectToast,
  hydrated,
  loadNotes,
  noteBox,
  noteMark,
  notePanelText,
  noteRow,
  notSaved,
  noteWithText,
  openCanvas,
  recordToasts,
  SEED_IDS,
  signInAs,
  WHOLE_CO,
  writeNote,
} from "./helpers";

// S14A-12 (item 9): a locked organization's refusal brings no fresh page and keeps the note's draft editable, marked
// "Not saved"; a save on a note deleted meanwhile in another session takes the draft with it (the note leaves the canvas
// with the fresh page, no mark stays).

test("S14A-12: a locked organization: the draft stays with the mark, editable in the panel with Not saved", async ({ page }) => {
  const note = (await noteWithText(DEMO_NOTES.free))!;
  // Anna also works in Retail Co; signing in there with its password leaves InfoMate locked in her session (S13-10)
  await addPerson(SEED_IDS.userMarek, SEED_IDS.wsSales, { name: "Anna", email: "anna.nowak@infomate.pl", role: "modeler" });
  await recordToasts(page);
  await signInAs(page, "Anna Nowak");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  const other = await page.context().newPage();
  await other.goto(`/w/${SEED_IDS.wsRetailDwh}`);
  await signOutViaMenu(other);
  await signInWithPassword(other, "anna.nowak@infomate.pl", "Retail Co");
  await other.close();

  await writeNote(page, note.id, "Mine, while locked.");
  await expectToast(page, "Unlock InfoMate first: open it and enter its password.");
  await expect(noteBox(page, note.id).getByTestId("note-text")).toHaveText("Mine, while locked.");
  await expect(noteMark(page, note.id)).toBeVisible();
  await noteMark(page, note.id).click();
  const panel = page.getByTestId("panel-note");
  await expect(notSaved(panel)).toHaveText("Not saved");
  await expect(notePanelText(page)).toHaveValue("Mine, while locked.");
  await expect(notePanelText(page)).toHaveJSProperty("readOnly", false);
  expect((await noteRow(note.id))!.body_text).toBe(note.body_text);
});

test("S14A-12: a note deleted meanwhile: the save is refused, the note and its draft go", async ({ page }) => {
  const note = (await noteWithText(DEMO_NOTES.free))!;
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);

  await deleteNoteAsAnna(note.id);
  await writeNote(page, note.id, "Mine, on a deleted note.");
  await expectToast(page, /does not exist/i);
  await expect(noteBox(page, note.id)).toHaveCount(0);
  await expect(page.getByTestId("note-not-saved")).toHaveCount(0);
  expect((await loadNotes()).some((n) => n.id === note.id)).toBe(false);
});
