import { deleteLabel } from "../../src/domain/commands/label";
import { expect, test, type Page } from "./fixtures";
import {
  asLukasz,
  deleteButton,
  expectAt,
  expectToast,
  furnishOrderManagement,
  key,
  labelNamed,
  OM,
  OM_HOME,
  OWN,
  rawDb,
  RETAIL,
  redoButton,
  rowsOn,
  signInAs,
  store,
  undoButton,
  WS_HOME,
} from "./helpers";

// S12A-09 (items 12, 14): Undo from the toast restores the project, its own canvas with its content, its links and pins,
// and its tile; Redo deletes it again; Ctrl+Z on the workspace home undoes it as well. A delete whose pinned label was
// deleted afterwards cannot be undone: the existing message, nothing written, the step leaves the history.

const tile = (page: Page) => page.getByTestId("tile-project").filter({ hasText: "Order management" });
const omLive = async () => (await rawDb()).project.find((p) => p.id === OM)!.deleted_at === null;

async function deleteOm(page: Page) {
  await page.goto(OM_HOME);
  await deleteButton(page).click();
  await deleteButton(page).click();
  await expectToast(page, "Deleted the project Order management and 1 canvas that only it used. The model is untouched.");
  await expectAt(page, WS_HOME);
}

test("S12A-09: Undo from the toast and Ctrl+Z bring the deleted project back with everything; Redo deletes again; a lost pinned label refuses the undo", async ({ page }) => {
  await furnishOrderManagement();
  const db = await rawDb();
  const before = { own: await rowsOn(OWN), links: db.project_canvas.filter((l) => l.project_id === OM), pins: db.project_pinned_label.filter((p) => p.project_id === OM) };
  const liveOn = async () => {
    const rows = await rowsOn(OWN);
    return [rows.items, rows.frames, rows.notes].map((r) => r.filter((x) => x.deleted_at === null).length);
  };
  const liveBefore = await liveOn();
  expect(before.pins).toHaveLength(1);

  await signInAs(page, "Łukasz");
  await deleteOm(page);
  // Undo in the toast: back, with its tile
  await page.getByTestId("toast-action").click();
  await expectToast(page, "Undone: Delete project Order management");
  await expect.poll(omLive).toBe(true);
  await expect(tile(page)).toHaveCount(1);
  const after = await rawDb();
  expect(after.canvas.find((c) => c.id === OWN)!.deleted_at).toBeNull();
  expect(await liveOn()).toEqual(liveBefore);
  const byCanvas = (a: { canvas_id: string }, b: { canvas_id: string }) => a.canvas_id.localeCompare(b.canvas_id);
  expect(after.project_canvas.filter((l) => l.project_id === OM).sort(byCanvas)).toEqual([...before.links].sort(byCanvas));
  expect(after.project_pinned_label.filter((p) => p.project_id === OM)).toEqual(before.pins);
  await expectAt(page, WS_HOME);

  // Redo deletes it again; Ctrl+Z on the workspace home brings it back
  await redoButton(page).click();
  await expectToast(page, "Redone: Delete project Order management");
  await expect.poll(omLive).toBe(false);
  await expect(tile(page)).toHaveCount(0);
  await key(page, "Control+z");
  await expectToast(page, "Undone: Delete project Order management");
  await expect.poll(omLive).toBe(true);
  await expect(tile(page)).toHaveCount(1);

  // deleted again; then CR-23 (pinned to it) is deleted: the undo is refused, nothing written, the step dropped
  await deleteOm(page);
  const s = store();
  const [label, links, pins, canvases, canvasItems] = await Promise.all([labelNamed("CR-23"), s.labels.listLinks(RETAIL), s.labels.listPins(RETAIL), s.canvases.list(RETAIL), s.canvasItems.list(RETAIL)]);
  await asLukasz((ctx, access) => deleteLabel(ctx, access, { label: label!, links, pins, canvases, canvasItems }, { labelId: label!.id, expectedVersion: label!.version }));
  const frozen = JSON.stringify(await rawDb().then((d) => [d.project, d.canvas, d.project_canvas, d.project_pinned_label]));
  await undoButton(page).click();
  await expectToast(page, "Couldn't undo “Delete project Order management” because it was changed afterwards. Ctrl+Z again goes further back.");
  expect(await omLive()).toBe(false);
  expect(JSON.stringify(await rawDb().then((d) => [d.project, d.canvas, d.project_canvas, d.project_pinned_label]))).toBe(frozen);
});
