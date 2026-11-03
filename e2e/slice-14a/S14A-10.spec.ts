import { expect, test } from "./fixtures";
import {
  card,
  changeNoteAsAnna,
  DEMO_NOTES,
  expectToast,
  hydrated,
  keepMine,
  noteBox,
  noteMark,
  notePanelText,
  noteRow,
  noteWithText,
  openWithNote,
  otherValue,
  recordToasts,
  signInAs,
  STALE,
  writeNote,
} from "./helpers";

// S14A-10 (item 11, N8): a pinned note's conflict behaves as S14A-04's, with the mark where the pinned note is drawn
// (beside its card, with its tether); the card's panel lists it by the draft, marked "Not saved" (N4, step 4).

test("S14A-10: a pinned note: the draft with the mark beside its card; the mark opens the line; Keep mine stores it", async ({ page }) => {
  const note = (await noteWithText(DEMO_NOTES.pinned))!;
  expect(note.pin_canvas_item_id ?? note.pin_frame_id).toBeTruthy();
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openWithNote(page, note.id);
  await hydrated(page);
  const box = noteBox(page, note.id);
  await expect(box).toHaveAttribute("data-pinned", "true");

  await changeNoteAsAnna(note.id, { text: "Theirs: confirmed and shipped." });
  await writeNote(page, note.id, "Mine: confirmed only.");
  await expectToast(page, STALE);
  await expect(box.getByTestId("note-text")).toHaveText("Mine: confirmed only.");
  await expect(noteMark(page, note.id)).toBeVisible();

  // the card's panel lists its pinned note by the draft, marked "Not saved" (N4, step 4)
  await page.keyboard.press("Escape");
  const head = (await card(page, "order_line").locator(".c-head").first().boundingBox())!;
  await page.mouse.click(head.x + head.width / 3, head.y + head.height / 2);
  const row = page.getByTestId("item-note-here").filter({ hasText: "Mine: confirmed only." });
  await expect(row).toBeVisible();
  await expect(row.getByTestId("note-row-not-saved")).toHaveText("Not saved");

  await page.keyboard.press("Escape");
  await noteMark(page, note.id).click();
  const panel = page.getByTestId("panel-note");
  await expect(otherValue(panel)).toHaveText("Theirs: confirmed and shipped.");
  await expect(notePanelText(page)).toHaveValue("Mine: confirmed only.");
  await keepMine(panel).click();
  await expect.poll(async () => (await noteRow(note.id))!.body_text).toBe("Mine: confirmed only.");
  await expect(noteMark(page, note.id)).toHaveCount(0);
  await expect(box).toHaveAttribute("data-pinned", "true");
});
