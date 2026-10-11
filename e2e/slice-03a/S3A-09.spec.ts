import { createNote, moveNote } from "../../src/domain/commands/note";
import { expect, test } from "./fixtures";
import {
  asLukasz,
  blockEl,
  card,
  CO,
  DEMO_NOTES,
  frameNamed,
  key,
  loadNotes,
  makeFrame,
  namePoint,
  newSession,
  noteEl,
  noteWithText,
  openCanvas,
  RETAIL,
  signInAs,
  store,
  toolboxAt,
  canvasUrl,
} from "./helpers";
import type { Page } from "./fixtures";

const VIEW = { x: -560, y: 40, zoom: 0.6 };
const state = async () => ({
  canvas: await store().canvases.get(RETAIL, CO),
  items: await store().canvasItems.listOfCanvas(RETAIL, CO),
  frames: await store().frames.listOfCanvas(RETAIL, CO),
  notes: await loadNotes(),
});
const headerCount = (page: Page, name: string) => card(page, name).getByTestId("mark-notes");

test("S3A-09: a card's header shows its pinned notes; card and frame panels list their notes; a collapsed block shows “N notes”; the overview lists the open notes, and “Show resolved notes on the canvas” hides resolved ones for this person only, after a reload too, without an undo step", async ({ page, browser }) => {
  test.setTimeout(150_000);
  // a frame with a note pinned to it and the demo's free note moved into it
  await makeFrame({ x: 1104, y: 120, width: 400, height: 320 }, { name: "Remarks" });
  const frame = (await frameNamed("Remarks"))!;
  const s0 = await state();
  await asLukasz((ctx, access) => createNote(ctx, access, s0, { canvasId: CO, text: "Ask about the load window", pin: { frameId: frame.id } }));
  const free = (await noteWithText(DEMO_NOTES.free))!;
  const s1 = await state();
  await asLukasz((ctx, access) => moveNote(ctx, access, s1, { noteId: free.id, expectedVersion: free.version, x: free.x + 8, y: free.y + 8 }));
  expect((await noteWithText(DEMO_NOTES.free))!.frame_id).toBe(frame.id);

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEW);

  // order_line's header: its two notes (open, and resolved while resolved notes show)
  await expect(headerCount(page, "order_line")).toHaveAttribute("data-count", "2");
  await expect(headerCount(page, "order_line")).toHaveAttribute("title", "2 notes pinned here");
  await expect(headerCount(page, "customers")).toHaveCount(0);

  // the card panel's Notes: first line, open or resolved
  await card(page, "order_line").getByTestId("card-name").click();
  const here = page.getByTestId("section-notes").getByTestId("item-note-here");
  await expect(here).toHaveCount(2);
  await expect(here.filter({ hasText: DEMO_NOTES.pinned })).toContainText("open");
  await expect(here.filter({ hasText: DEMO_NOTES.resolved })).toContainText("resolved");
  // a link selects the note
  await here.filter({ hasText: DEMO_NOTES.pinned }).click();
  await expect(page.getByTestId("panel-note")).toBeVisible();

  // back at the view (the link brought the note into view)
  await openCanvas(page, canvasUrl(), VIEW);

  // the frame panel's Notes: the note pinned to the frame
  const name = await namePoint(page, "Remarks");
  await page.mouse.click(name.x, name.y);
  await expect(page.getByTestId("panel-frame")).toBeVisible();
  await expect(page.getByTestId("section-notes").getByTestId("item-note-here")).toHaveText(["Ask about the load windowopen"]);

  // collapsed: the block counts the note pinned to the frame and the free note in it
  await toolboxAt(page, await namePoint(page, "Remarks"));
  await page.getByTestId("toolbox-frame-collapse").click();
  await expect(blockEl(page, "Remarks").getByTestId("block-chip").last()).toHaveText("2 notes");
  await page.getByTestId("block").getByTestId("button-block-expand").click();
  await expect(page.getByTestId("block")).toHaveCount(0);

  // the overview: the open notes as links, and the checkbox
  await key(page, "Escape");
  const overview = page.getByTestId("section-canvas-notes");
  const links = overview.getByTestId("canvas-note-link");
  await expect(links).toHaveCount(3);
  await expect(links.filter({ hasText: DEMO_NOTES.pinned })).toContainText("order_line");
  await expect(links.filter({ hasText: DEMO_NOTES.resolved })).toHaveCount(0);
  const undo = page.getByTestId("button-undo");
  const undoBefore = await undo.isEnabled();
  const show = page.getByTestId("checkbox-show-resolved");
  await expect(show).toBeChecked();
  await expect(noteEl(page, DEMO_NOTES.resolved)).toHaveCount(1);
  await show.uncheck();
  await expect(noteEl(page, DEMO_NOTES.resolved)).toHaveCount(0);
  await expect(headerCount(page, "order_line")).toHaveAttribute("data-count", "1");
  expect(await undo.isEnabled()).toBe(undoBefore);
  expect((await noteWithText(DEMO_NOTES.resolved))!.status).toBe("resolved");

  // after a reload too
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  await expect(noteEl(page, DEMO_NOTES.pinned)).toHaveCount(1);
  await expect(noteEl(page, DEMO_NOTES.resolved)).toHaveCount(0);
  await expect(page.getByTestId("checkbox-show-resolved")).not.toBeChecked();

  // another person still sees them
  const piotr = await newSession(browser, "Piotr Wiśniewski");
  await openCanvas(piotr.page, canvasUrl(), VIEW);
  await expect(noteEl(piotr.page, DEMO_NOTES.resolved)).toHaveCount(1);
  await expect(piotr.page.getByTestId("checkbox-show-resolved")).toBeChecked();
  await piotr.context.close();
});
