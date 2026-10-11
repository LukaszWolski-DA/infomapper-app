import { expect, test } from "./fixtures";
import {
  AROUND,
  blockHeadPoint,
  collapsedFrame,
  emptySpot,
  frameNamed,
  headPoint,
  item,
  key,
  loadNotes,
  makeFrame,
  namePoint,
  openCanvas,
  signInAs,
  toolboxAt,
  treeItem,
  canvasUrl,
  FRAMED,
} from "./helpers";
import type { Page } from "./fixtures";

/** Writes the new note's text on the canvas and saves it with Ctrl+Enter; returns the saved note. */
async function write(page: Page, text: string) {
  const input = page.getByTestId("input-note-text");
  await expect(input).toBeFocused();
  await page.keyboard.type(text);
  await page.keyboard.press("Control+Enter");
  await expect.poll(async () => (await loadNotes()).some((n) => n.body_text === text)).toBe(true);
  await expect(page.getByTestId("input-note-text")).toHaveCount(0);
  return (await loadNotes()).find((n) => n.body_text === text)!;
}
const menuItem = (page: Page, name: string) => page.getByTestId("menu-toolbox").getByRole("menuitem", { name });

test("S3A-06: the Note tool (N) makes a free note on the empty canvas and a pinned note on a card, a frame's name and a collapsed block; an empty new note leaves nothing and no undo step; the toolbox and panel entries make notes too", async ({ page }) => {
  test.setTimeout(120_000);
  await makeFrame(AROUND.customers, { name: "Area" });
  await collapsedFrame(AROUND.customer, { name: "Folded" });
  const area = (await frameNamed("Area"))!, folded = (await frameNamed("Folded"))!;
  await signInAs(page, "Łukasz");
  // room above the frames' names at the top
  await openCanvas(page, canvasUrl(), FRAMED);
  const before = (await loadNotes()).length;
  const undoButton = page.getByTestId("button-undo");
  await expect(undoButton).toBeDisabled();

  // an empty new note disappears: Esc, or leaving it empty; nothing saved, no undo step
  await key(page, "n");
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-mode", "note");
  let spot = await emptySpot(page);
  await page.mouse.click(spot.x, spot.y);
  await expect(page.getByTestId("input-note-text")).toBeFocused();
  // the tool ends after one note
  await expect(page.getByTestId("area-canvas")).not.toHaveAttribute("data-mode", "note");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("note")).toHaveCount(before);
  await page.getByTestId("button-tool-note").click();
  spot = await emptySpot(page);
  await page.mouse.click(spot.x, spot.y);
  await expect(page.getByTestId("input-note-text")).toBeFocused();
  const away = await emptySpot(page);
  await page.mouse.click(away.x - 200, away.y + 100);
  await expect(page.getByTestId("input-note-text")).toHaveCount(0);
  await expect(page.getByTestId("note")).toHaveCount(before);
  expect(await loadNotes()).toHaveLength(before);
  await expect(undoButton).toBeDisabled();

  // a free note on the empty canvas: yellow, 220 px wide, open
  await key(page, "n");
  spot = await emptySpot(page);
  await page.mouse.click(spot.x, spot.y);
  const free = await write(page, "A free one");
  expect(free).toMatchObject({ pin_canvas_item_id: null, pin_frame_id: null, color: "yellow", width: 220, status: "open" });
  await expect(undoButton).toBeEnabled();

  // pinned to a card, to a collapsed frame by its block, to a frame by its name (its note lands right of it, on the
  // block's header: the block goes first)
  await key(page, "n");
  const head = await headPoint(page, "Sales Order");
  await page.mouse.click(head.x, head.y);
  expect((await write(page, "On Sales Order")).pin_canvas_item_id).toBe((await item("Sales Order")).id);
  await key(page, "n");
  const block = await blockHeadPoint(page, "Folded");
  await page.mouse.click(block.x, block.y);
  expect((await write(page, "On the block")).pin_frame_id).toBe(folded.id);
  await key(page, "n");
  const name = await namePoint(page, "Area");
  await page.mouse.click(name.x, name.y);
  expect((await write(page, "On the frame")).pin_frame_id).toBe(area.id);

  // the toolboxes: the empty canvas, a card, a frame
  spot = await emptySpot(page);
  expect(await toolboxAt(page, spot)).toContain("Add a note here");
  await menuItem(page, "Add a note here").click();
  expect((await write(page, "From the canvas toolbox")).pin_canvas_item_id).toBeNull();
  await toolboxAt(page, await headPoint(page, "order_header"));
  await menuItem(page, "Add a note to this").click();
  expect((await write(page, "From the card toolbox")).pin_canvas_item_id).toBe((await item("order_header")).id);
  await toolboxAt(page, await namePoint(page, "Area"));
  await menuItem(page, "Add a note to this frame").click();
  expect((await write(page, "From the frame toolbox")).pin_frame_id).toBe(area.id);

  // the card panel's “Add a note”
  // selected from the left panel: the notes made above may cover its name on the canvas
  await treeItem(page, "Order Line").click();
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await page.getByTestId("section-notes").getByTestId("button-add-note").click();
  expect((await write(page, "From the panel")).pin_canvas_item_id).toBe((await item("Order Line")).id);
  expect(await loadNotes()).toHaveLength(before + 8);
});
