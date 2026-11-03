// Slice 14a's e2e helpers (D-66 on the canvas's queue): frames, cards and notes changed by Anna as another session
// through the domain (the page does not know), a frame's panel opened from its name on the canvas, and a note on the
// canvas found by its id (its text may be a draft): selected, edited in place, its "Not saved" mark.

import { expect, type Page } from "@playwright/test";
import { updateCanvasItem } from "../../src/domain/commands/canvas-item";
import { updateFrame } from "../../src/domain/commands/frame";
import { deleteNote, updateNote } from "../../src/domain/commands/note";
import { CO, loadFrames, namePoint } from "../slice-02b/helpers";
import { loadNotes, WHOLE_CO } from "../slice-03a/helpers";
import { asUser, canvasUrl, loadItems, loadModel, openCanvas, RETAIL, SEED_IDS, store } from "../slice-13/helpers";

export * from "../slice-13/helpers";
export { CO, dragBetween, FRAMED, frameEl, frameNamed, loadFrames, makeFrame, namePoint } from "../slice-02b/helpers";
export { DEMO_NOTES, loadNotes, noteWithText, WHOLE_CO } from "../slice-03a/helpers";

/** A frame changed by Anna, as another session would (the page does not know). */
export async function changeFrameAsAnna(frameId: string, change: { name?: string; color?: string; kind?: string; conceptId?: string }, canvasId: string = CO) {
  const model = await loadModel();
  const frame = (await loadFrames(canvasId)).find((f) => f.id === frameId)!;
  await asUser(SEED_IDS.userAnna, (ctx, access) =>
    updateFrame(ctx, access, { frame, concepts: model.concepts, sourceSystems: model.sourceSystems }, { frameId, expectedVersion: frame.version, ...change }),
  );
}

/** A card of an entity collapsed or expanded by Anna (its row's version grows; its place does not change). */
export async function toggleCardAsAnna(name: string, canvasId: string = CO) {
  const entity = (await loadModel()).entities.find((e) => e.name === name)!;
  const item = (await loadItems(RETAIL, canvasId)).find((i) => i.entity_id === entity.id)!;
  await asUser(SEED_IDS.userAnna, (ctx, access) => updateCanvasItem(ctx, access, { item }, { canvasItemId: item.id, expectedVersion: item.version, collapsed: !item.collapsed }));
}

/** A frame's stored row by its id. */
export const frameRow = async (frameId: string, canvasId: string = CO) => (await loadFrames(canvasId)).find((f) => f.id === frameId)!;

/** Selects a frame by a click on its name on the canvas; returns its panel. */
export async function openFrame(page: Page, name: string) {
  const at = await namePoint(page, name);
  await page.mouse.click(at.x, at.y);
  const panel = page.getByTestId("panel-frame");
  await expect(panel).toBeVisible();
  return panel;
}

// ---- notes (step 3) ----

/** A note's stored row by its id, deleted or not. */
export const noteRow = async (noteId: string, canvasId: string = CO) => (await store().notes.listOfCanvas(RETAIL, canvasId)).find((n) => n.id === noteId);

/** The canvas's state as the note commands read it. */
async function noteState(canvasId: string) {
  const s = store();
  const [canvas, items, frames, notes] = await Promise.all([
    s.canvases.get(RETAIL, canvasId),
    s.canvasItems.listOfCanvas(RETAIL, canvasId),
    s.frames.listOfCanvas(RETAIL, canvasId),
    s.notes.listOfCanvas(RETAIL, canvasId),
  ]);
  return { canvas, items, frames, notes };
}

/** A note changed by Anna, as another session would (the page does not know). */
export async function changeNoteAsAnna(noteId: string, change: { text?: string; color?: string; status?: string }, canvasId: string = CO) {
  const state = await noteState(canvasId);
  const note = state.notes.find((n) => n.id === noteId)!;
  await asUser(SEED_IDS.userAnna, (ctx, access) => updateNote(ctx, access, state, { noteId, expectedVersion: note.version, ...change }));
}

/** A note deleted by Anna. */
export async function deleteNoteAsAnna(noteId: string, canvasId: string = CO) {
  const note = (await loadNotes(canvasId)).find((n) => n.id === noteId)!;
  await asUser(SEED_IDS.userAnna, (ctx, access) => deleteNote(ctx, access, { note }, { noteId, expectedVersion: note.version }));
}

/** A note on the canvas by its id, and its parts. */
export const noteBox = (page: Page, noteId: string) => page.locator(`[data-note="${noteId}"]`);
export const noteMark = (page: Page, noteId: string) => noteBox(page, noteId).getByTestId("note-not-saved");
export const noteEditor = (page: Page) => page.getByTestId("input-note-text");
export const notePanelText = (page: Page) => page.getByTestId("panel-note").getByTestId("input-note-panel-text");

/** Selects a note by a click on its header (beside its pin label); its panel shows. */
export async function selectNote(page: Page, noteId: string) {
  const head = await noteBox(page, noteId).getByTestId("note-pin").boundingBox();
  await page.mouse.click(head!.x + 4, head!.y + head!.height / 2);
  await expect(page.getByTestId("panel-note")).toBeVisible();
}

/** Starts editing a note on the canvas: a double-click on its text; the editor has the focus. */
export async function editNote(page: Page, noteId: string) {
  const body = await noteBox(page, noteId).getByTestId("note-text").boundingBox();
  await page.mouse.dblclick(body!.x + body!.width / 2, body!.y + Math.min(8, body!.height / 2));
  await expect(noteEditor(page)).toBeFocused();
}

/** Writes a note's text on the canvas and leaves it with Ctrl+Enter. */
export async function writeNote(page: Page, noteId: string, text: string) {
  await editNote(page, noteId);
  await noteEditor(page).fill(text);
  await page.keyboard.press("Control+Enter");
  await expect(noteEditor(page)).toHaveCount(0);
}

/** Opens the demo canvas at `WHOLE_CO`, moved so that the note lies inside the view, clear of the right panel. */
export async function openWithNote(page: Page, noteId: string) {
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  const b = (await noteBox(page, noteId).boundingBox())!;
  const vp = page.viewportSize()!;
  const dx = Math.min(0, vp.width - 460 - (b.x + b.width));
  const dy = Math.min(0, vp.height - 200 - (b.y + b.height));
  if (dx || dy) await openCanvas(page, canvasUrl(), { ...WHOLE_CO, x: WHOLE_CO.x + dx, y: WHOLE_CO.y + dy });
}
