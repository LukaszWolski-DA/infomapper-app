// S14A-13's quick commit check (slice 14a, step 3; the full S14A-13 is step 4): canvas commits on the demo canvas while a
// note is written on the canvas, saved, refused, marked and dropped with "Use this". The counter exists only in
// development (`__imCanvasCommits`), so this runs on the e2e dev server, on demand. Each phase is read once the counter
// settles; the numbers go to test-results/S14A-13-commits.json and the step's report.
//
//   COMMITS=1 npx playwright test e2e/slice-14a/S14A-13-commits.spec.ts

import fs from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  changeNoteAsAnna,
  DEMO_NOTES,
  editNote,
  expectToast,
  hydrated,
  noteEditor,
  noteMark,
  noteRow,
  noteWithText,
  openWithNote,
  otherValue,
  settledCommits,
  signInAs,
  STALE,
  useThis,
} from "./helpers";

test.skip(!process.env.COMMITS, "a measurement: COMMITS=1");

const commits = (page: Page) => page.evaluate(() => (window as unknown as { __imCanvasCommits?: number }).__imCanvasCommits ?? 0);
const settled = (page: Page) => settledCommits(page, commits);

test("S14A-13 commits: typing in a note on the canvas, its save, a refusal with the mark, Use this", async ({ page }) => {
  const note = (await noteWithText(DEMO_NOTES.free))!;
  await signInAs(page, "Łukasz");
  await openWithNote(page, note.id);
  await hydrated(page);
  const out: Record<string, number> = {};
  const phase = async (name: string, act: () => Promise<void>) => {
    const before = await settled(page);
    await act();
    out[name] = (await settled(page)) - before;
  };

  await phase("start editing (double-click)", () => editNote(page, note.id));
  // a short text first, so the 20 characters stay on one line: a new line grows the note, and its measured height is a
  // canvas commit (`onHeight`, since slice 3a), which the next phase records
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Short.");
  await phase("typing 20 characters", async () => {
    await page.keyboard.type(" iiiiiiiiiiiiiiiiiii");
  });
  await phase("typing 20 characters more (a new line)", async () => {
    await page.keyboard.type(" abcdefghijklmnopqrs");
  });
  await phase("leaving the editor, the save stored", async () => {
    await page.keyboard.press("Control+Enter");
    await expect.poll(async () => (await noteRow(note.id))!.body_text).toContain("abcdefghijklmnopqrs");
  });

  await changeNoteAsAnna(note.id, { text: "Theirs." });
  await editNote(page, note.id);
  await noteEditor(page).fill("Mine.");
  await phase("leaving the editor, the save refused (the mark, the fresh page)", async () => {
    await page.keyboard.press("Control+Enter");
    await expectToast(page, STALE);
    await expect(noteMark(page, note.id)).toBeVisible();
  });
  await phase("the mark clicked (select, panel)", async () => {
    await noteMark(page, note.id).click();
    await expect(otherValue(page.getByTestId("panel-note"))).toHaveText("Theirs.");
  });
  await phase("Use this", async () => {
    await useThis(page.getByTestId("panel-note")).click();
    await expect(noteMark(page, note.id)).toHaveCount(0);
  });

  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync("test-results/S14A-13-commits.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  expect(out["typing 20 characters"]).toBe(0);
  expect(out["Use this"]).toBe(0);
});
