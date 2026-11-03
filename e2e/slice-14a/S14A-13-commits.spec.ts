// S14A-13's commit bar (slice 14a, step 4): canvas commits on the demo canvas while a note is written on the canvas,
// saved, refused, refused while the canvas's overview list shows (its answer held, then released with nothing
// selected), and on this branch its mark clicked and "Use this". The counter exists only in development
// (`__imCanvasCommits`), so this runs on the e2e dev server, on demand. The file uses only what slice 13 has too, so the
// same file runs in a `slice-13` worktree for the A/B (SIDE names the side). Each phase is read once the counter
// settles. Results in test-results/S14A-13-commits-<SIDE>.json.
//
//   COMMITS=1 SIDE=branch npx playwright test e2e/slice-14a/S14A-13-commits.spec.ts

import fs from "node:fs";
import type { Page } from "@playwright/test";
import { updateNote } from "../../src/domain/commands/note";
import { DEMO_NOTES, noteWithText, WHOLE_CO } from "../slice-03a/helpers";
import { expect, test } from "../slice-13/fixtures";
import { asUser, canvasUrl, expectToast, holdUntil, hydrated, openCanvas, RETAIL, SEED_IDS, settledCommits, signInAs, STALE, store } from "../slice-13/helpers";

test.skip(!process.env.COMMITS, "a measurement: COMMITS=1");

const SIDE = process.env.SIDE ?? "branch";
const commits = (page: Page) => page.evaluate(() => (window as unknown as { __imCanvasCommits?: number }).__imCanvasCommits ?? 0);
const box = (page: Page, id: string) => page.locator(`[data-note="${id}"]`);
const editor = (page: Page) => page.getByTestId("input-note-text");

async function anna(noteId: string, text: string) {
  const s = store();
  const canvasId = SEED_IDS.canvasCustomerOrders;
  const [canvas, items, frames, notes] = await Promise.all([s.canvases.get(RETAIL, canvasId), s.canvasItems.listOfCanvas(RETAIL, canvasId), s.frames.listOfCanvas(RETAIL, canvasId), s.notes.listOfCanvas(RETAIL, canvasId)]);
  const note = notes.find((n) => n.id === noteId)!;
  await asUser(SEED_IDS.userAnna, (ctx, access) => updateNote(ctx, access, { canvas, items, frames, notes }, { noteId, expectedVersion: note.version, text }));
}

async function edit(page: Page, id: string) {
  const b = (await box(page, id).getByTestId("note-text").boundingBox())!;
  await page.mouse.dblclick(b.x + b.width / 2, b.y + Math.min(8, b.height / 2));
  await expect(editor(page)).toBeFocused();
}

test("S14A-13 commits: typing in a note on the canvas, its save, a refusal, a refusal under the overview's list, the mark, Use this", async ({ page }) => {
  const note = (await noteWithText(DEMO_NOTES.free))!;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  const out: Record<string, number> = {};
  const settled = () => settledCommits(page, commits);
  const phase = async (name: string, act: () => Promise<void>) => {
    const before = await settled();
    await act();
    out[name] = (await settled()) - before;
  };

  await phase("double-click to edit", () => edit(page, note.id));
  // a short text first, so the 20 characters stay on one line (a new line grows the note: its measured height)
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Short.");
  await phase("typing 20 characters", () => page.keyboard.type(" iiiiiiiiiiiiiiiiiii"));
  await phase("leaving the editor, the save stored", async () => {
    await page.keyboard.press("Control+Enter");
    await expect.poll(async () => (await noteWithText("Short."))?.id).toBe(note.id);
  });

  await anna(note.id, "Theirs one.");
  await edit(page, note.id);
  await editor(page).fill("Mine one.");
  await phase("leaving the editor, the save refused", async () => {
    await page.keyboard.press("Control+Enter");
    await expectToast(page, STALE);
  });
  if (SIDE === "branch") {
    const mark = box(page, note.id).getByTestId("note-not-saved");
    await phase("the mark clicked", async () => {
      await page.keyboard.press("Escape");
      await mark.click();
      await expect(page.getByTestId("panel-note").getByTestId("draft-conflict")).toBeVisible();
    });
    await phase("Use this", async () => {
      await page.getByTestId("panel-note").getByTestId("button-use-this").click();
      await expect(mark).toHaveCount(0);
    });
  }

  // a refusal answered while nothing is selected and the canvas's overview lists the note
  await anna(note.id, "Theirs two.");
  await edit(page, note.id);
  await editor(page).fill("Mine two.");
  const hold = await holdUntil(page, note.id);
  await page.keyboard.press("Control+Enter");
  await expect.poll(hold.held).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("list-canvas-notes")).toBeVisible();
  await phase("a refusal answered under the overview's list", async () => {
    hold.release();
    await hold.given;
    await expectToast(page, STALE);
  });

  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync(`test-results/S14A-13-commits-${SIDE}.json`, JSON.stringify(out, null, 2));
  console.log(SIDE, JSON.stringify(out));
});
