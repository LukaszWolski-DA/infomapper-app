import { expect, test } from "./fixtures";
import {
  addNote,
  canvasData,
  CO,
  deleteEntityAs,
  deleteFrameAs,
  deleteNoteAs,
  deleteRequirementAs,
  expectDrawn,
  expectedOf,
  item,
  makeFrame,
  OM_HOME,
  signInAs,
  thumbnailOf,
  tileOf,
} from "./helpers";

// S12B-05 (PRD item 10; D-20; step 1, F16): a card of a deleted entity, a deleted frame, a deleted note and a deleted
// requirement's card are not drawn; a pinned note is not drawn; a note that was pinned to the deleted entity's card is
// drawn as a free note at its place.

test("S12B-05: deleted things are not drawn; a note pinned to a deleted entity's card is drawn where it was", async ({ page }) => {
  const customer = await item("Customer", CO);
  const pinned = await addNote(CO, "Ask about the customer key", { pinTo: customer.id });
  const blue = (await canvasData(CO)).notes.find((n) => n.color === "blue")!;
  const frameId = await makeFrame({ x: 1600, y: 40, width: 300, height: 200 }, { name: "Spare", canvasId: CO });

  await signInAs(page, "Łukasz");
  await page.goto(OM_HOME);
  const tile = tileOf(page, "Customer & orders");
  let t = (await thumbnailOf(page, tile))!;
  // the pinned notes (the new one and the seed's two) are not drawn
  expect(t.rects.filter((r) => r.kind === "note").map((r) => r.color)).toEqual(["blue"]);
  expect(t.rects.filter((r) => r.kind === "frame")).toHaveLength(1);

  await deleteFrameAs(frameId);
  await deleteNoteAs(blue.id);
  await deleteRequirementAs("REQ-104");
  await deleteEntityAs("Customer");
  await page.reload();
  t = (await thumbnailOf(page, tile))!;
  const data = await canvasData(CO);
  expectDrawn(t, expectedOf(data));
  expect(t.rects.filter((r) => r.kind === "frame" || r.kind === "requirement")).toEqual([]);
  expect(t.rects.filter((r) => r.kind === "entity")).toHaveLength(2);
  // the freed note is the only note, at the place it hung (to the right of Customer's card)
  const freed = data.notes.find((n) => n.id === pinned)!;
  expect(freed.pin_canvas_item_id).toBeNull();
  expect(freed.x).toBeGreaterThan(customer.x);
  expect(t.rects.filter((r) => r.kind === "note")).toHaveLength(1);
});
