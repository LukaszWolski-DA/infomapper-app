// Slice 14a, step 3: screenshots (runs only with SCREENS=<folder>, into docs/prd/slice-14a-screens/<folder>/): a note on
// the canvas with its "Not saved" mark, its panel with the conflict line, a frame's name with the line, and a read-only
// note after the archive (the canvas's mark and the panel's "Not saved. You can still copy it."), each in light and dark.
//
//   SCREENS=step-3 npx playwright test e2e/slice-14a/S14A-screens.spec.ts

import path from "node:path";
import { expect, test, type Page } from "./fixtures";
import {
  archive,
  canvasUrl,
  changeFrameAsAnna,
  changeNoteAsAnna,
  conflictLine,
  DEMO_NOTES,
  FRAMED,
  hydrated,
  makeFrame,
  noteBox,
  noteMark,
  noteWithText,
  notSaved,
  openCanvas,
  openFrame,
  openWithNote,
  signInAs,
  writeNote,
} from "./helpers";

const OUT = path.resolve("docs", "prd", "slice-14a-screens", process.env.SCREENS === "1" ? "latest" : (process.env.SCREENS ?? "latest"));

test.use({ viewport: { width: 1536, height: 864 } });
test.skip(!process.env.SCREENS, "screenshots only with SCREENS=<folder>");

/** The note on the canvas with room around it. */
async function noteShot(page: Page, noteId: string, name: string) {
  const b = (await noteBox(page, noteId).boundingBox())!;
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip: { x: b.x - 40, y: b.y - 40, width: b.width + 80, height: b.height + 80 } });
}

/** The top of the details panel. */
async function panelShot(page: Page, testId: string, name: string, height = 330) {
  const b = (await page.getByTestId(testId).boundingBox())!;
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip: { x: b.x - 16, y: b.y - 16, width: b.width + 32, height } });
}

async function start(page: Page, scheme: "light" | "dark", noteId: string) {
  await page.emulateMedia({ colorScheme: scheme });
  await signInAs(page, "Łukasz");
  await openWithNote(page, noteId);
  await hydrated(page);
}

for (const scheme of ["light", "dark"] as const) {
  test(`S14A screens (${scheme}): a note's conflict on the canvas and in its panel`, async ({ page }) => {
    const note = (await noteWithText(DEMO_NOTES.free))!;
    await start(page, scheme, note.id);
    await changeNoteAsAnna(note.id, { text: "Order lines come from ERP twice a night, at 1 and at 4." });
    await writeNote(page, note.id, "Order lines come from ERP once a night, at 2. Check the window with the ERP team.");
    await expect(noteMark(page, note.id)).toBeVisible();
    await page.keyboard.press("Escape");
    await page.mouse.move(0, 0);
    await noteShot(page, note.id, `note-mark-${scheme}`);
    await noteMark(page, note.id).click();
    await expect(conflictLine(page.getByTestId("panel-note"))).toBeVisible();
    await page.mouse.move(0, 0);
    await panelShot(page, "panel-note", `note-panel-conflict-${scheme}`, 360);
  });

  test(`S14A screens (${scheme}): a read-only note after the archive`, async ({ page }) => {
    const note = (await noteWithText(DEMO_NOTES.free))!;
    await start(page, scheme, note.id);
    await archive();
    await writeNote(page, note.id, "Typed before the archive: check the load window.");
    await expect(noteMark(page, note.id)).toBeVisible();
    await page.mouse.move(0, 0);
    await noteShot(page, note.id, `note-read-only-mark-${scheme}`);
    await noteMark(page, note.id).click();
    await expect(notSaved(page.getByTestId("panel-note"))).toBeVisible();
    await page.mouse.move(0, 0);
    await panelShot(page, "panel-note", `note-panel-read-only-${scheme}`);
  });

  test(`S14A screens (${scheme}): a conflict on a frame's name`, async ({ page }) => {
    const area = await makeFrame({ x: 472, y: 0, width: 304, height: 856 }, { name: "Area" });
    await page.emulateMedia({ colorScheme: scheme });
    await signInAs(page, "Łukasz");
    await openCanvas(page, canvasUrl(), FRAMED);
    await hydrated(page);
    const panel = await openFrame(page, "Area");
    await changeFrameAsAnna(area, { name: "Customer area" });
    await panel.getByTestId("input-frame-name").fill("Orders area");
    await panel.getByTestId("input-frame-name").press("Enter");
    await expect(conflictLine(panel)).toBeVisible();
    await page.mouse.move(0, 0);
    await panelShot(page, "panel-frame", `frame-name-conflict-${scheme}`, 260);
  });
}
