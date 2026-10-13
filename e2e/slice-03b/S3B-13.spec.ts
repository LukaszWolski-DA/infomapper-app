import { moveNote } from "../../src/domain/commands/note";
import { expect, test, type Page } from "./fixtures";
import {
  asLukasz,
  canvasUrl,
  CO,
  collapse,
  DEMO_NOTES,
  frameNamed,
  loadNotes,
  makeFrame,
  miniatureCommits,
  miniNoteColors,
  noteEl,
  notePoint,
  noteWithText,
  openCanvas,
  RETAIL,
  signInAs,
  store,
  WHOLE_CO,
} from "./helpers";

/** The colours of the notes the canvas shows (the miniature must draw exactly these). */
const shownColors = (page: Page) => page.getByTestId("note").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.color ?? "").sort());

test("S3B-13: the miniature draws the visible notes in their colours, not hidden resolved ones nor those in a collapsed frame; panning and zooming do not redraw it; dragging a note redraws it once, on the drop", async ({ page }) => {
  test.setTimeout(120_000);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  const all = (await loadNotes()).filter((n) => n.deleted_at === null).map((n) => n.color).sort();
  await expect(page.getByTestId("note")).toHaveCount(all.length);
  await expect.poll(() => miniNoteColors(page)).toEqual(all);

  // hidden resolved notes are not drawn
  await page.getByTestId("checkbox-show-resolved").uncheck();
  await expect(noteEl(page, DEMO_NOTES.resolved)).toHaveCount(0);
  await expect.poll(() => miniNoteColors(page)).toEqual(await shownColors(page));
  expect((await miniNoteColors(page)).length).toBe(all.length - 1);

  // panning and zooming do not redraw the miniature (S1A-14)
  await page.waitForTimeout(1000);
  const before = await miniatureCommits(page);
  expect(before).toBeGreaterThan(0); // the counter works
  const pane = (await page.locator(".react-flow__pane").boundingBox())!;
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(40, 30);
  await page.keyboard.down("Control");
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -100);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 100);
  await page.keyboard.up("Control");
  await page.waitForTimeout(1000);
  expect(await miniatureCommits(page), "commits while panning and zooming").toBe(before);

  // dragging the free note redraws it once, on the drop
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await page.waitForTimeout(1000);
  const start = await miniatureCommits(page);
  const from = await notePoint(page, DEMO_NOTES.free);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(from.x + i * 8, from.y + i * 6);
  expect(await miniatureCommits(page), "commits while dragging").toBe(start);
  await page.mouse.up();
  await expect.poll(async () => (await noteWithText(DEMO_NOTES.free))!.version).toBe(2);
  await page.waitForTimeout(1000);
  expect(await miniatureCommits(page), "commits after the drop").toBe(start + 1);
});

test("S3B-13: a note in a collapsed frame is not drawn in the miniature", async ({ page }) => {
  // the demo's free note moved into a frame (as S3A-09), the frame collapsed
  await makeFrame({ x: 1104, y: 120, width: 400, height: 320 }, { name: "Remarks" });
  const frame = (await frameNamed("Remarks"))!;
  const free = (await noteWithText(DEMO_NOTES.free))!;
  const state = {
    canvas: await store().canvases.get(RETAIL, CO),
    items: await store().canvasItems.listOfCanvas(RETAIL, CO),
    frames: await store().frames.listOfCanvas(RETAIL, CO),
    notes: await loadNotes(),
  };
  await asLukasz((ctx, access) => moveNote(ctx, access, state, { noteId: free.id, expectedVersion: free.version, x: free.x + 8, y: free.y + 8 }));
  await collapse(frame.id);

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await expect(page.getByTestId("block")).toHaveCount(1);
  await expect(noteEl(page, DEMO_NOTES.free)).toHaveCount(0);
  await expect.poll(() => miniNoteColors(page)).toEqual(await shownColors(page));
  expect((await miniNoteColors(page)).length).toBe((await loadNotes()).filter((n) => n.deleted_at === null).length - 1);
});
